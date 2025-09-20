(function(){
	"use strict";

	// Elements
	const scoreEl = document.getElementById("score");
	const highScoreEl = document.getElementById("highScore");
	const streakEl = document.getElementById("streak");
	const questionEl = document.getElementById("question");
	const tipEl = document.getElementById("tip");
	const answerInput = document.getElementById("answer");
	const answerForm = document.getElementById("answerForm");
	const feedbackEl = document.getElementById("feedback");
	const timerBar = document.getElementById("timerBar");
	const timerText = document.getElementById("timerText");
	const startBtn = document.getElementById("startBtn");
	const nextBtn = document.getElementById("nextBtn");
	const modal = document.getElementById("summaryModal");
	const finalScoreEl = document.getElementById("finalScore");
	const bestScoreEl = document.getElementById("bestScore");
	const playAgainBtn = document.getElementById("playAgainBtn");
	
	// Screen elements
	const introScreen = document.getElementById("introScreen");
	const mainMenuScreen = document.getElementById("mainMenuScreen");
	const topicScreen = document.getElementById("topicScreen");
	const playBtn = document.getElementById("playBtn");
	const quitBtn = document.getElementById("quitBtn");
	const backBtn = document.getElementById("backBtn");
	const startGameBtn = document.getElementById("startGameBtn");
	const menuBestScore = document.getElementById("menuBestScore");
	
	// Topic checkboxes
	const tAdd = document.getElementById("t_add");
	const tSub = document.getElementById("t_sub");
	const tMul = document.getElementById("t_mul");
	const tDiv = document.getElementById("t_div");
	const tSquare = document.getElementById("t_square");
	const tCube = document.getElementById("t_cube");
	const tSqrt = document.getElementById("t_sqrt");
	const tMemory = document.getElementById("t_memory");
	const tPuzzle = document.getElementById("t_puzzle");

	// Puzzle elements
	const regularQuestion = document.getElementById("regularQuestion");
	const puzzleQuestion = document.getElementById("puzzleQuestion");
	const puzzleGrid = document.getElementById("puzzleGrid");
	const puzzleOptions = document.getElementById("puzzleOptions");

	// State
	const PER_QUESTION_SECONDS = 20.0;
	let timerId = null;
	let questionStart = 0;
	let remainingMs = PER_QUESTION_SECONDS * 1000;
	let score = 0;
	let streak = 0;
	let current = null; // { q, a, tip, type }
	let isActive = false;
	let autoNextId = null;
	let activeGenerators = [];
	let revealId = null;
	let selectedPuzzleOption = null;

	// Storage
	const getBest = () => Number(localStorage.getItem("qm_best") || 0);
	const setBest = (v) => localStorage.setItem("qm_best", String(v));
	
	function updateHud(){
		scoreEl.textContent = String(score);
		highScoreEl.textContent = String(getBest());
		streakEl.textContent = String(streak);
	}

	function setTip(text){
		tipEl.textContent = text ? `Tip: ${text}` : "";
	}

	function setFeedback(text, ok){
		feedbackEl.textContent = text;
		feedbackEl.style.color = ok ? "#86efac" : "#fca5a5";
	}

	function clearTimers(){
		clearInterval(timerId);
		clearTimeout(autoNextId);
		clearTimeout(revealId);
		autoNextId = null;
		revealId = null;
	}

	function startTimer(){
		clearInterval(timerId);
		questionStart = performance.now();
		remainingMs = PER_QUESTION_SECONDS * 1000;
		updateTimerBar();
		timerId = setInterval(()=>{
			const elapsed = performance.now() - questionStart;
			remainingMs = Math.max(0, PER_QUESTION_SECONDS*1000 - elapsed);
			updateTimerBar();
			if(remainingMs <= 0){
				clearInterval(timerId);
				onTimeUp();
			}
		}, 60);
	}

	function updateTimerBar(){
		const ratio = remainingMs / (PER_QUESTION_SECONDS*1000);
		timerBar.style.width = `${Math.max(0, Math.min(1, ratio))*100}%`;
		timerBar.style.background = ratio < 0.25 ? `linear-gradient(90deg,#ef4444,#f97316)` : `linear-gradient(90deg,#34d399,#22c55e)`;
		timerText.textContent = `${(remainingMs/1000).toFixed(1)}s`;
	}

	function randomInt(min, max){
		return Math.floor(Math.random()*(max-min+1))+min;
	}

	// Memory sequence reveal helper
	async function revealSequence(nums){
		return new Promise(resolve => {
			let i = 0;
			const showNext = ()=>{
				if(i >= nums.length){
					questionEl.textContent = "What is the sum?";
					resolve();
					return;
				}
				questionEl.textContent = String(nums[i]);
				i++;
				revealId = setTimeout(showNext, 800); // 0.8s per number
			};
			showNext();
		});
	}

	// All generators catalogue (now includes memory)
	const allGenerators = [
		{ topic:"add", build: ()=>{ const a=[19,29,39,49,59,69,79,89,99][randomInt(0,8)]; const b=randomInt(12,48); return { q:`${a} + ${b} = ?`, a:a+b, tip:"Round a number (e.g., 49→50), add, then subtract 1.", type:"add_comp" }; } },
		{ topic:"sub", build: ()=>{ const b=randomInt(11,49); return { q:`100 - ${b} = ?`, a:100-b, tip:"Think in complements to 100.", type:"sub_100" }; } },
		{ topic:"mul", build: ()=>{ const n=randomInt(7,99); return { q:`${n} × 9 = ?`, a:n*9, tip:"Compute 10×n then subtract n.", type:"mul_9" }; } },
		{ topic:"mul", build: ()=>{ const tens=randomInt(1,9), ones=randomInt(0,9); const n=tens*10+ones; return { q:`${n} × 11 = ?`, a:n*11, tip:"For ab×11 → a(a+b)b; carry if a+b ≥ 10.", type:"mul_11" }; } },
		{ topic:"square", build: ()=>{ const k=randomInt(3,9)*10+5; return { q:`${k}² = ?`, a:k*k, tip:"For (10n+5)² → n·(n+1) then append 25.", type:"sq_5" }; } },
		{ topic:"add", build: ()=>{ const a=randomInt(10,999), b=randomInt(10,999); return { q:`${a} + ${b} = ?`, a:a+b, tip:"Add hundreds, tens, ones separately.", type:"add_general" }; } },
		{ topic:"sub", build: ()=>{ let a=randomInt(50,999), b=randomInt(10,950); if(b>a){const t=a;a=b;b=t;} return { q:`${a} - ${b} = ?`, a:a-b, tip:"Subtract placewise; borrow if needed.", type:"sub_general" }; } },
		{ topic:"mul", build: ()=>{ const a=randomInt(3,19), b=randomInt(3,19); return { q:`${a} × ${b} = ?`, a:a*b, tip:"Break into tens and ones or use known tables.", type:"mul_general" }; } },
		{ topic:"div", build: ()=>{ const b=randomInt(2,20), q=randomInt(2,20), a=b*q; return { q:`${a} ÷ ${b} = ?`, a:q, tip:"What times divisor gives dividend?", type:"div_int" }; } },
		{ topic:"square", build: ()=>{ const n=randomInt(11,39); return { q:`${n}² = ?`, a:n*n, tip:"Use (n±1)² = n² ± 2n + 1.", type:"square_any" }; } },
		{ topic:"cube", build: ()=>{ const n=randomInt(1,20); return { q:`${n}³ = ?`, a:n*n*n, tip:"Memorize 1–10; use (a±1)³ for near values.", type:"cube" }; } },
		{ topic:"sqrt", build: ()=>{ const base=randomInt(4,35); const sq=base*base; return { q:`√${sq} = ?`, a:base, tip:"Recall perfect squares up to 35².", type:"sqrt" }; } },
		{ topic:"memory", build: ()=>{
				// Generate a short sequence and compute sum, reveal them before starting the timer
				const len = randomInt(3, 6);
				const nums = Array.from({length: len}, ()=> randomInt(3, 19));
				const sum = nums.reduce((a,b)=>a+b,0);
				return { q: "", a: sum, tip: "Chunk numbers (e.g., 7+13≈20) and keep a running total.", type:"memory", reveal: nums };
			}
		},
		{ topic:"puzzle", build: ()=>{
				// Generate a 3x3 math puzzle with pattern
				const patterns = [
					// Addition pattern: each row sums to same value
					()=>{
						const target = randomInt(20, 50);
						const row1 = [randomInt(5,15), randomInt(5,15), target - randomInt(5,15) - randomInt(5,15)];
						const row2 = [randomInt(5,15), randomInt(5,15), target - randomInt(5,15) - randomInt(5,15)];
						const row3 = [randomInt(5,15), randomInt(5,15), "?"];
						return { grid: [row1, row2, row3], answer: target, pattern: "Each row sums to the same value" };
					},
					// Multiplication pattern: each row multiplies to same value
					()=>{
						const target = randomInt(30, 200);
						const row1 = [randomInt(2,8), randomInt(2,8), Math.floor(target / (randomInt(2,8) * randomInt(2,8)))];
						const row2 = [randomInt(2,8), randomInt(2,8), Math.floor(target / (randomInt(2,8) * randomInt(2,8)))];
						const row3 = [randomInt(2,8), randomInt(2,8), "?"];
						return { grid: [row1, row2, row3], answer: Math.floor(target / (row3[0] * row3[1])), pattern: "Each row multiplies to the same value" };
					},
					// Diagonal pattern: main diagonal sums to target
					()=>{
						const target = randomInt(15, 40);
						const grid = [
							[randomInt(3,12), randomInt(3,12), randomInt(3,12)],
							[randomInt(3,12), randomInt(3,12), randomInt(3,12)],
							[randomInt(3,12), randomInt(3,12), "?"]
						];
						const answer = target - grid[0][0] - grid[1][1];
						return { grid, answer, pattern: "Main diagonal sums to the same value" };
					}
				];
				const pattern = patterns[randomInt(0, patterns.length-1)]();
				const options = [pattern.answer];
				// Generate 3 wrong options
				while(options.length < 4){
					const wrong = pattern.answer + randomInt(-10, 10);
					if(wrong > 0 && !options.includes(wrong)) options.push(wrong);
				}
				// Shuffle options
				for(let i = options.length-1; i > 0; i--){
					const j = Math.floor(Math.random() * (i+1));
					[options[i], options[j]] = [options[j], options[i]];
				}
				return { q: "", a: pattern.answer, tip: pattern.pattern, type:"puzzle", grid: pattern.grid, options };
			}
		}
	];

	function chooseActiveGenerators(){
		const topics = new Set();
		if(tAdd && tAdd.checked){ topics.add("add"); }
		if(tSub && tSub.checked){ topics.add("sub"); }
		if(tMul && tMul.checked){ topics.add("mul"); }
		if(tDiv && tDiv.checked){ topics.add("div"); }
		if(tSquare && tSquare.checked){ topics.add("square"); }
		if(tCube && tCube.checked){ topics.add("cube"); }
		if(tSqrt && tSqrt.checked){ topics.add("sqrt"); }
		if(tMemory && tMemory.checked){ topics.add("memory"); }
		if(tPuzzle && tPuzzle.checked){ topics.add("puzzle"); }
		if(topics.size === 0){ ["add","sub","mul","div","square","cube","sqrt","memory","puzzle"].forEach(t=>topics.add(t)); }
		activeGenerators = allGenerators.filter(g => topics.has(g.topic));
	}

	function renderPuzzle(){
		// Clear previous puzzle
		puzzleGrid.innerHTML = "";
		puzzleOptions.innerHTML = "";
		selectedPuzzleOption = null;

		// Create 3x3 grid
		current.grid.forEach(row => {
			row.forEach(cell => {
				const cellEl = document.createElement("div");
				cellEl.className = "puzzle-cell";
				cellEl.textContent = cell;
				puzzleGrid.appendChild(cellEl);
			});
		});

		// Create 4 answer options
		current.options.forEach((option, index) => {
			const optionEl = document.createElement("div");
			optionEl.className = "puzzle-option";
			optionEl.textContent = option;
			optionEl.addEventListener("click", () => {
				// Remove previous selection
				document.querySelectorAll(".puzzle-option").forEach(el => el.classList.remove("selected"));
				// Select this option
				optionEl.classList.add("selected");
				selectedPuzzleOption = option;
			});
			puzzleOptions.appendChild(optionEl);
		});
	}

	async function nextQuestion(){
		if(activeGenerators.length === 0){ chooseActiveGenerators(); }
		const g = activeGenerators[randomInt(0, activeGenerators.length-1)];
		current = g.build();
		setFeedback("", true);
		answerInput.value = "";
		answerInput.blur();
		isActive = false;
		clearTimers();

		// Show appropriate question type
		if(current.type === "puzzle"){
			regularQuestion.classList.add("hidden");
			puzzleQuestion.classList.remove("hidden");
			renderPuzzle();
			setTip(current.tip);
			isActive = true;
			startTimer();
		}else if(current.type === "memory" && current.reveal){
			regularQuestion.classList.remove("hidden");
			puzzleQuestion.classList.add("hidden");
			// Freeze timer UI during reveal
			timerBar.style.width = "100%";
			timerText.textContent = "Watch";
			await revealSequence(current.reveal);
			// Now ask for sum and start timer
			setTip(current.tip);
			answerInput.value = "";
			answerInput.focus();
			isActive = true;
			startTimer();
		}else{
			regularQuestion.classList.remove("hidden");
			puzzleQuestion.classList.add("hidden");
			questionEl.textContent = current.q;
			setTip(current.tip);
			answerInput.focus();
			isActive = true;
			startTimer();
		}
	}

	function scheduleAutoNext(){
		clearTimeout(autoNextId);
		autoNextId = setTimeout(()=>{ nextQuestion(); }, 900);
	}

	function onTimeUp(){
		isActive = false;
		setFeedback(`Time's up! Answer: ${current.a}`, false);
		streak = 0;
		streakEl.textContent = String(streak);
		scheduleAutoNext();
	}

	function awardPoints(timeTakenMs){
		const base = 10;
		const speedBonus = Math.max(0, Math.floor((PER_QUESTION_SECONDS*1000 - timeTakenMs)/500));
		const streakBonus = Math.min(10, Math.floor(streak/3));
		return base + speedBonus + streakBonus;
	}

	function submitAnswer(){
		if(!isActive) return;
		
		// Handle puzzle mode
		if(current.type === "puzzle"){
			if(!selectedPuzzleOption) return;
			clearInterval(timerId);
			isActive = false;
			
			const correct = selectedPuzzleOption === current.a;
			if(correct){
				const timeTaken = performance.now() - questionStart;
				streak += 1;
				score += awardPoints(timeTaken);
				setFeedback("Correct!", true);
			}else{
				streak = 0;
				setFeedback(`Oops! Correct: ${current.a}`, false);
			}
			updateHud();
			scheduleAutoNext();
			return;
		}

		// Handle regular questions
		const raw = answerInput.value.trim();
		if(raw === "") return;
		clearInterval(timerId);
		isActive = false;

		const expected = current.a;
		const userNum = Number(raw);
		const correct = Number.isFinite(userNum) && userNum === expected;

		if(correct){
			const timeTaken = performance.now() - questionStart;
			streak += 1;
			score += awardPoints(timeTaken);
			setFeedback("Correct!", true);
		}else{
			streak = 0;
			setFeedback(`Oops! Correct: ${expected}`, false);
		}
		updateHud();
		scheduleAutoNext();
	}

	function showScreen(screenId){
		// Hide all screens
		introScreen.classList.add("hidden");
		mainMenuScreen.classList.add("hidden");
		topicScreen.classList.add("hidden");
		modal.classList.add("hidden");
		
		// Show target screen
		if(screenId === "intro") introScreen.classList.remove("hidden");
		else if(screenId === "menu") mainMenuScreen.classList.remove("hidden");
		else if(screenId === "topics") topicScreen.classList.remove("hidden");
		else if(screenId === "summary") modal.classList.remove("hidden");
	}

	function startGame(){
		score = 0;
		streak = 0;
		updateHud();
		setFeedback("", true);
		chooseActiveGenerators();
		showScreen("game");
		nextQuestion();
	}

	function maybeEndRun(){
		// Endless mode for now
	}

	function showSummary(){
		finalScoreEl.textContent = String(score);
		const best = Math.max(score, getBest());
		setBest(best);
		bestScoreEl.textContent = String(best);
		updateHud();
		showScreen("summary");
	}

	// Events
	answerForm.addEventListener("submit", (e)=>{ e.preventDefault(); submitAnswer(); });
	startBtn.addEventListener("click", startGame);
	playAgainBtn.addEventListener("click", ()=>{ startGame(); });
	
	// Navigation events
	playBtn.addEventListener("click", ()=>{ showScreen("topics"); });
	quitBtn.addEventListener("click", ()=>{ showScreen("menu"); });
	backBtn.addEventListener("click", ()=>{ showScreen("menu"); });
	startGameBtn.addEventListener("click", startGame);
	
	// Keyboard shortcuts
	document.addEventListener("keydown", (e)=>{
		if(e.key === "Enter"){ return; }
		if(e.key.toLowerCase() === "s"){ startGame(); }
		if(e.key === "Escape"){ showSummary(); }
	});

	// Init
	function init(){
		highScoreEl.textContent = String(getBest());
		menuBestScore.textContent = String(getBest());
		updateTimerBar();
		questionEl.textContent = "Press Start to begin";
		
		// Start with intro animation, then show menu after 2.5s
		setTimeout(()=>{
			showScreen("menu");
		}, 2500);
	}
	
	init();
})();

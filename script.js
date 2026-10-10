
"use strict";

const TOTAL_LEVELS = 5;
const QUESTIONS_PER_LEVEL = 5;
const GAME_TIME = 180;

const LEVELS = [
  { title: "Binary Basics", type: "binary" },
  { title: "Carry Protocol", type: "carry" },
  { title: "Signed Combat", type: "signed" },
  { title: "Overflow Zone", type: "overflow" },
  { title: "FINAL BOSS", type: "mixed" }
];

let level = 0;
let questionNumber = 0;
let score = 0;
let streak = 0;
let bestStreak = 0;
let answered = 0;
let correctAnswers = 0;
let timeLeft = GAME_TIME;
let timerInterval = null;
let currentQuestion = null;
let hasAnswered = false;
let hintUsed = false;
let comparisonVisible = false;
let gameFinished = false;

function toBits(n) {
  return (n & 15).toString(2).padStart(4, "0");
}

function signedValue(n) {
  return n >= 8 ? n - 16 : n;
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getArithmetic(a, b) {
  const fullSum = a + b;
  const stored = fullSum & 15;
  const carry = fullSum > 15 ? 1 : 0;
  const overflow = ((~(a ^ b) & (a ^ stored) & 8) !== 0);

  return {
    fullSum,
    stored,
    carry,
    overflow,
    signedA: signedValue(a),
    signedB: signedValue(b),
    signedResult: signedValue(stored)
  };
}

function makeOptions(correct, generator) {
  const options = [correct];
  let attempts = 0;

  while (options.length < 4 && attempts < 500) {
    const candidate = generator();
    if (!options.includes(candidate)) {
      options.push(candidate);
    }
    attempts++;
  }

  return shuffle(options);
}

function makeQuestion(type) {
  const a = randomInt(16);
  const b = randomInt(16);
  const math = getArithmetic(a, b);

  if (type === "mixed") {
    type = ["binary", "carry", "signed", "overflow"][randomInt(4)];
  }

  let prompt;
  let correct;
  let options;

  if (type === "binary") {
    prompt = "What is the 4-bit stored result?";
    correct = toBits(math.stored);
    options = makeOptions(correct, () => toBits(randomInt(16)));
  } else if (type === "carry") {
    prompt = "What is the 5-bit unsigned sum, including carry-out?";
    correct = math.fullSum.toString(2).padStart(5, "0");
    options = makeOptions(
      correct,
      () => randomInt(32).toString(2).padStart(5, "0")
    );
  } else if (type === "signed") {
    prompt = "What is the signed value of the stored 4-bit result?";
    correct = String(math.signedResult);
    options = makeOptions(correct, () => String(randomInt(16) - 8));
  } else {
    prompt = "Which carry-out and signed-overflow flags are correct?";
    correct = `Carry ${math.carry} · Overflow ${math.overflow ? 1 : 0}`;
    options = makeOptions(
      correct,
      () => `Carry ${randomInt(2)} · Overflow ${randomInt(2)}`
    );
  }

  return {
    type, a, b, ...math, prompt, correct, options
  };
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });
  document.getElementById(id).classList.add("active");
}

function showHome() {
  stopTimer();
  showScreen("home-screen");
}

function showTutorial() {
  showScreen("tutorial-screen");
}

function startGame() {
  stopTimer();

  level = 0;
  questionNumber = 0;
  score = 0;
  streak = 0;
  bestStreak = 0;
  answered = 0;
  correctAnswers = 0;
  timeLeft = GAME_TIME;
  hasAnswered = false;
  hintUsed = false;
  comparisonVisible = false;
  gameFinished = false;

  showScreen("game-screen");
  updateStats();
  nextQuestion();
  startTimer();
}

function startTimer() {
  stopTimer();

  timerInterval = setInterval(() => {
    if (gameFinished) {
      stopTimer();
      return;
    }

    timeLeft--;
    document.getElementById("timer").textContent = timeLeft;

    if (timeLeft <= 0) {
      finishGame(true);
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateStats() {
  document.getElementById("score").textContent = score;
  document.getElementById("streak").textContent = streak + " 🔥";
  document.getElementById("timer").textContent = timeLeft;

  const total = TOTAL_LEVELS * QUESTIONS_PER_LEVEL;
  document.getElementById("progress-bar").style.width =
    (answered / total * 100) + "%";
}

function nextQuestion() {
  if (gameFinished) return;

  hasAnswered = false;
  hintUsed = false;
  comparisonVisible = false;

  if (questionNumber >= QUESTIONS_PER_LEVEL) {
    level++;
    questionNumber = 0;

    if (level >= TOTAL_LEVELS) {
      finishGame(false);
      return;
    }
  }

  const config = LEVELS[level];
  currentQuestion = makeQuestion(config.type);

  document.getElementById("level-label").textContent =
    `LEVEL ${String(level + 1).padStart(2, "0")}`;
  document.getElementById("level-title").textContent = config.title;
  document.getElementById("question-count").textContent =
    `${questionNumber + 1} / ${QUESTIONS_PER_LEVEL}`;
  document.getElementById("question-type").textContent =
    currentQuestion.type.toUpperCase() + " CHALLENGE";
  document.getElementById("question-prompt").textContent =
    currentQuestion.prompt;

  document.getElementById("operand-a").textContent = toBits(currentQuestion.a);
  document.getElementById("operand-b").textContent = toBits(currentQuestion.b);
  document.querySelector(".question-mark").textContent = "????";

  document.getElementById("feedback").className = "feedback hidden";
  document.getElementById("next-btn").classList.add("hidden");

  document.getElementById("hint-btn").disabled = false;
  document.getElementById("hint-btn").textContent = "💡 HINT";

  document.getElementById("comparison").classList.add("hidden");
  document.getElementById("comparison").textContent = "";

  ["full-sum", "stored-result", "carry-out", "overflow"].forEach(id => {
    document.getElementById(id).textContent = "—";
  });

  renderAnswers();
  updateStats();
}

function renderAnswers() {
  const container = document.getElementById("answers");
  container.innerHTML = "";

  currentQuestion.options.forEach(option => {
    const button = document.createElement("button");
    button.className = "answer-btn";
    button.textContent = option;
    button.onclick = () => checkAnswer(option, button);
    container.appendChild(button);
  });
}

function checkAnswer(selected, button) {
  if (hasAnswered || gameFinished) return;

  hasAnswered = true;
  answered++;

  const q = currentQuestion;
  const isCorrect = selected === q.correct;

  document.querySelectorAll(".answer-btn").forEach(btn => {
    btn.disabled = true;

    if (btn.textContent === q.correct) {
      btn.classList.add("correct");
    }
  });

  if (isCorrect) {
    correctAnswers++;
    streak++;
    bestStreak = Math.max(bestStreak, streak);
    score += 100 + Math.min(streak - 1, 10) * 10;
  } else {
    streak = 0;
    button.classList.add("wrong");
  }

  document.querySelector(".question-mark").textContent = toBits(q.stored);

  showArithmetic(q);
  showFeedback(isCorrect, q);

  document.getElementById("next-btn").classList.remove("hidden");

  questionNumber++;
  updateStats();
}

function showArithmetic(q) {
  document.getElementById("full-sum").textContent =
    `${q.a} + ${q.b} = ${q.fullSum}`;
  document.getElementById("stored-result").textContent = toBits(q.stored);
  document.getElementById("carry-out").textContent = q.carry;
  document.getElementById("overflow").textContent =
    q.overflow ? "YES" : "NO";
}

function showFeedback(isCorrect, q) {
  const feedback = document.getElementById("feedback");
  feedback.className = "feedback " + (isCorrect ? "good" : "bad");

  let explanation = "";

  if (q.type === "binary") {
    explanation =
      `${toBits(q.a)} + ${toBits(q.b)} gives ` +
      `${q.fullSum.toString(2)}. Keep the lowest four bits: ` +
      `${toBits(q.stored)}.`;
  } else if (q.type === "carry") {
    explanation =
      `Unsigned: ${q.a} + ${q.b} = ${q.fullSum}. ` +
      `The 5-bit answer is ${q.fullSum.toString(2).padStart(5, "0")}. ` +
      `Carry-out is ${q.carry}.`;
  } else if (q.type === "signed") {
    explanation =
      `${toBits(q.a)} represents ${q.signedA} and ` +
      `${toBits(q.b)} represents ${q.signedB} as signed 4-bit values. ` +
      `Their mathematical sum is ${q.signedA + q.signedB}. ` +
      `The stored bits ${toBits(q.stored)} represent ${q.signedResult}` +
      `${q.overflow ? ", so signed overflow occurs." : "."}`;
  } else {
    explanation =
      `Carry-out = ${q.carry}. Signed overflow = ` +
      `${q.overflow ? 1 : 0}. Carry-out describes unsigned addition; ` +
      `overflow describes whether the signed result fits in the range −8 to +7.`;
  }

  feedback.textContent = "";

  const heading = document.createElement("strong");
  heading.textContent = isCorrect ? "✓ CORRECT!" : "✗ NOT QUITE!";

  const result = document.createElement("p");
  result.textContent = isCorrect
    ? "Great work!"
    : "Correct answer: " + q.correct;

  const detail = document.createElement("p");
  detail.textContent = explanation;

  feedback.append(heading, result, detail);
}

function useHint() {
  if (hasAnswered || hintUsed) return;

  hintUsed = true;

  document.getElementById("hint-btn").disabled = true;
  document.getElementById("hint-btn").textContent = "HINT USED";

  const q = currentQuestion;
  let hint = "";

  if (q.type === "binary") {
    hint = "Add from right to left. Store only the lowest 4 bits.";
  } else if (q.type === "carry") {
    hint = "Add the operands as unsigned numbers. A sum above 15 needs a fifth bit.";
  } else if (q.type === "signed") {
    hint = "Convert each operand to a signed value, add them, then interpret the lowest 4 bits.";
  } else {
    hint = "Carry-out is the fifth bit. Overflow happens when same-sign operands produce a result with the opposite sign.";
  }

  const feedback = document.getElementById("feedback");
  feedback.className = "feedback";
  feedback.textContent = "💡 Hint: " + hint;
}

function toggleComparison() {
  if (!currentQuestion) return;

  comparisonVisible = !comparisonVisible;

  const box = document.getElementById("comparison");

  if (!comparisonVisible) {
    box.classList.add("hidden");
    return;
  }

  const q = currentQuestion;

  box.textContent =
    `UNSIGNED: ${q.a} + ${q.b} = ${q.a + q.b}. ` +
    `Stored bits: ${toBits(q.stored)}. Carry-out: ${q.carry}. ` +
    `SIGNED: ${q.signedA} + ${q.signedB} = ${q.signedA + q.signedB}. ` +
    `Stored bits mean ${q.signedResult}. Overflow: ` +
    `${q.overflow ? "YES" : "NO"}.`;

  box.classList.remove("hidden");
}

function finishGame(timeExpired) {
  if (gameFinished) return;

  gameFinished = true;
  stopTimer();
  showScreen("results-screen");

  const total = TOTAL_LEVELS * QUESTIONS_PER_LEVEL;
  const accuracy = answered === 0
    ? 0
    : Math.round(correctAnswers / answered * 100);

  document.getElementById("result-title").textContent =
    timeExpired
      ? "TIME'S UP!"
      : correctAnswers >= 20
        ? "PROCESSOR CHAMPION!"
        : "BATTLE COMPLETE!";

  document.getElementById("result-message").textContent =
    timeExpired
      ? "The timer ran out. Train again and beat your score!"
      : `You answered ${correctAnswers} of ${total} questions correctly.`;

  document.getElementById("final-score").textContent = score;
  document.getElementById("accuracy").textContent = accuracy + "%";
  document.getElementById("best-streak").textContent = bestStreak;
  document.getElementById("answered").textContent = `${answered} / ${total}`;
}

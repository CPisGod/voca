// app.js — 화면 전환 및 UI 로직
import { addWord, fetchActiveWords, fetchDeletedWords, setChecked, softDeleteWord } from './db.js';

// ---------- DOM refs ----------
const screens = document.querySelectorAll('.screen');
const navBtns = document.querySelectorAll('.nav-btn');
const segBtns = document.querySelectorAll('.seg-btn');
const subviews = document.querySelectorAll('.subview');

const wordForm = document.getElementById('wordForm');
const wordInput = document.getElementById('wordInput');
const meaningInput = document.getElementById('meaningInput');
const saveMsg = document.getElementById('saveMsg');

const wordCountEl = document.getElementById('wordCount');
const wordListItems = document.getElementById('wordListItems');
const listEmpty = document.getElementById('listEmpty');
const showDeletedBtn = document.getElementById('showDeletedBtn');

const deletedModal = document.getElementById('deletedModal');
const deletedListItems = document.getElementById('deletedListItems');
const deletedEmpty = document.getElementById('deletedEmpty');
const closeDeletedBtn = document.getElementById('closeDeletedBtn');

const progressLabel = document.getElementById('progressLabel');
const reshuffleBtn = document.getElementById('reshuffleBtn');
const cardStage = document.getElementById('cardStage');
const wordCard = document.getElementById('wordCard');
const cardWord = document.getElementById('cardWord');
const cardMeaning = document.getElementById('cardMeaning');
const cardCover = document.getElementById('cardCover');
const checkBtn = document.getElementById('checkBtn');
const deleteBtn = document.getElementById('deleteBtn');
const memorizeEmpty = document.getElementById('memorizeEmpty');
const cardControls = document.querySelector('.card-controls');

// ---------- State ----------
let shuffleQueue = [];
let currentIndex = 0;
let deleteConfirmTimeout = null;

// ---------- Screen switching ----------
navBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    navBtns.forEach((b) => b.classList.toggle('active', b === btn));
    const target = btn.dataset.screen;
    screens.forEach((s) => s.classList.toggle('active', s.id === target));
    if (target === 'memorizeScreen') loadMemorizeSession();
  });
});

segBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    segBtns.forEach((b) => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    const target = btn.dataset.subview;
    subviews.forEach((v) => v.classList.toggle('active', v.id === target));
    if (target === 'wordList') refreshWordList();
  });
});

// ---------- Add word ----------
wordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const word = wordInput.value.trim();
  const meaning = meaningInput.value.trim();
  if (!word || !meaning) return;

  const submitBtn = wordForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  saveMsg.textContent = '';

  try {
    await addWord(word, meaning);
    wordInput.value = '';
    meaningInput.value = '';
    wordInput.focus();
    saveMsg.style.color = 'var(--gold)';
    saveMsg.textContent = `"${word}" 저장했어요.`;
  } catch (err) {
    console.error(err);
    saveMsg.style.color = 'var(--red)';
    saveMsg.textContent = '저장에 실패했어요. 인터넷 연결과 Firebase 설정을 확인해주세요.';
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Word list (추가창) ----------
async function refreshWordList() {
  wordListItems.innerHTML = '';
  let words = [];
  try {
    words = await fetchActiveWords();
  } catch (err) {
    console.error(err);
  }
  wordCountEl.textContent = `${words.length}개`;
  listEmpty.hidden = words.length > 0;
  words.forEach((w) => {
    wordListItems.appendChild(buildWordItem(w, false));
  });
}

function buildWordItem(w, isDeleted) {
  const li = document.createElement('li');
  const wordSpan = document.createElement('span');
  wordSpan.className = 'w-word';
  wordSpan.textContent = w.word;
  if (!isDeleted && w.checked) {
    const check = document.createElement('span');
    check.className = 'w-check';
    check.textContent = '✓';
    wordSpan.appendChild(check);
  }
  const meaningSpan = document.createElement('span');
  meaningSpan.className = 'w-meaning';
  meaningSpan.textContent = w.meaning;
  li.appendChild(wordSpan);
  li.appendChild(meaningSpan);
  return li;
}

showDeletedBtn.addEventListener('click', async () => {
  deletedModal.hidden = false;
  deletedListItems.innerHTML = '';
  deletedEmpty.hidden = true;
  try {
    const list = await fetchDeletedWords();
    deletedEmpty.hidden = list.length > 0;
    deletedEmpty.textContent = '삭제된 단어가 없어요.';
    list.forEach((w) => deletedListItems.appendChild(buildWordItem(w, true)));
  } catch (err) {
    console.error(err);
    deletedEmpty.hidden = false;
    deletedEmpty.textContent = '삭제된 단어를 불러오지 못했어요.';
  }
});
closeDeletedBtn.addEventListener('click', () => { deletedModal.hidden = true; });
deletedModal.addEventListener('click', (e) => {
  if (e.target === deletedModal) deletedModal.hidden = true;
});

// ---------- Memorize session (암기창) ----------
async function loadMemorizeSession() {
  progressLabel.textContent = '· · ·';
  let words = [];
  try {
    words = await fetchActiveWords();
  } catch (err) {
    console.error(err);
  }
  shuffleQueue = shuffle(words);
  currentIndex = 0;
  renderCard();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderCard() {
  clearDeleteConfirm();
  const total = shuffleQueue.length;
  const current = shuffleQueue[currentIndex];

  if (!current) {
    cardStage.hidden = true;
    cardControls.hidden = true;
    memorizeEmpty.hidden = false;
    memorizeEmpty.textContent = total === 0
      ? '암기할 단어가 없어요. 먼저 단어를 추가해주세요.'
      : '모든 단어를 다 봤어요! "다시 섞기"로 한 번 더 볼 수 있어요.';
    progressLabel.textContent = `${total} / ${total}`;
    return;
  }

  cardStage.hidden = false;
  cardControls.hidden = false;
  memorizeEmpty.hidden = true;

  wordCard.classList.remove('revealed');
  cardWord.textContent = current.word;
  cardMeaning.textContent = current.meaning;
  checkBtn.classList.toggle('checked', !!current.checked);
  progressLabel.textContent = `${currentIndex + 1} / ${total}`;
}

cardCover.addEventListener('click', () => {
  wordCard.classList.add('revealed');
});

reshuffleBtn.addEventListener('click', loadMemorizeSession);

// ---------- Check (기록용 — 체크해도 셔플에 계속 포함) ----------
checkBtn.addEventListener('click', async () => {
  const current = shuffleQueue[currentIndex];
  if (!current) return;
  const next = !current.checked;
  current.checked = next;
  checkBtn.classList.toggle('checked', next);
  try {
    await setChecked(current.id, next);
  } catch (err) {
    console.error(err);
    current.checked = !next;
    checkBtn.classList.toggle('checked', !next);
  }
});

// ---------- Delete (소프트 삭제 — 두 번 탭해서 확인) ----------
function clearDeleteConfirm() {
  deleteBtn.classList.remove('confirming');
  deleteBtn.textContent = '삭제';
  if (deleteConfirmTimeout) {
    clearTimeout(deleteConfirmTimeout);
    deleteConfirmTimeout = null;
  }
}

deleteBtn.addEventListener('click', async () => {
  const current = shuffleQueue[currentIndex];
  if (!current) return;

  if (!deleteBtn.classList.contains('confirming')) {
    deleteBtn.classList.add('confirming');
    deleteBtn.textContent = '정말 삭제?';
    deleteConfirmTimeout = setTimeout(clearDeleteConfirm, 3000);
    return;
  }

  clearDeleteConfirm();
  try {
    await softDeleteWord(current.id);
    shuffleQueue.splice(currentIndex, 1);
    renderCard();
  } catch (err) {
    console.error(err);
  }
});

// ---------- Swipe to advance ----------
let dragging = false;
let startX = 0;

wordCard.addEventListener('touchstart', (e) => {
  if (!shuffleQueue[currentIndex]) return;
  dragging = true;
  startX = e.touches[0].clientX;
  wordCard.style.transition = 'none';
}, { passive: true });

wordCard.addEventListener('touchmove', (e) => {
  if (!dragging) return;
  const dx = e.touches[0].clientX - startX;
  wordCard.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`;
}, { passive: true });

wordCard.addEventListener('touchend', (e) => {
  if (!dragging) return;
  dragging = false;
  const dx = e.changedTouches[0].clientX - startX;
  wordCard.style.transition = 'transform .25s ease, opacity .25s ease';

  if (Math.abs(dx) > 70) {
    const flyX = dx > 0 ? window.innerWidth : -window.innerWidth;
    wordCard.style.transform = `translateX(${flyX}px) rotate(${dx / 30}deg)`;
    wordCard.style.opacity = '0';
    setTimeout(() => {
      currentIndex += 1;
      wordCard.style.transition = 'none';
      wordCard.style.transform = 'translateX(0) rotate(0)';
      wordCard.style.opacity = '0';
      renderCard();
      void wordCard.offsetWidth; // 리플로우 강제 → 아래 트랜지션이 먹히게 함
      wordCard.style.transition = 'opacity .2s ease';
      wordCard.style.opacity = '1';
    }, 250);
  } else {
    wordCard.style.transform = 'translateX(0) rotate(0)';
  }
});

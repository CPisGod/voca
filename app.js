// app.js — 화면 전환 및 UI 로직
import {
  DEFAULT_FOLDER_ID, ensureDefaultFolder, fetchFolders, addFolder, renameFolder,
  addWord, fetchActiveWords, fetchDeletedWords, setChecked, softDeleteWord,
} from './db.js';

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

const folderSwitchBtn = document.getElementById('folderSwitchBtn');
const currentFolderNameEl = document.getElementById('currentFolderName');
const folderModal = document.getElementById('folderModal');
const closeFolderBtn = document.getElementById('closeFolderBtn');
const folderListItems = document.getElementById('folderListItems');
const newFolderForm = document.getElementById('newFolderForm');
const newFolderInput = document.getElementById('newFolderInput');

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
let folders = [];
let currentFolderId = localStorage.getItem('voca_current_folder') || DEFAULT_FOLDER_ID;

// ---------- Init ----------
(async function init() {
  try {
    await ensureDefaultFolder();
  } catch (err) {
    console.error(err);
  }
  await refreshFolders();
  refreshWordList();
})();

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

// ---------- Folders ----------
async function refreshFolders() {
  try {
    folders = await fetchFolders();
  } catch (err) {
    console.error(err);
    folders = [];
  }
  if (!folders.some((f) => f.id === currentFolderId)) {
    currentFolderId = folders[0] ? folders[0].id : DEFAULT_FOLDER_ID;
  }
  localStorage.setItem('voca_current_folder', currentFolderId);
  const current = folders.find((f) => f.id === currentFolderId);
  currentFolderNameEl.textContent = current ? current.name : '폴더';
}

function renderFolderModal() {
  folderListItems.innerHTML = '';
  folders.forEach((f) => {
    folderListItems.appendChild(buildFolderItem(f));
  });
}

function buildFolderItem(f) {
  const li = document.createElement('li');
  li.className = 'folder-item';
  li.classList.toggle('active', f.id === currentFolderId);

  const nameBtn = document.createElement('button');
  nameBtn.type = 'button';
  nameBtn.className = 'folder-name-btn';
  nameBtn.textContent = f.name;
  nameBtn.addEventListener('click', async () => {
    currentFolderId = f.id;
    await refreshFolders();
    folderModal.hidden = true;
    refreshWordList();
  });

  const renameBtn = document.createElement('button');
  renameBtn.type = 'button';
  renameBtn.className = 'icon-btn folder-rename-btn';
  renameBtn.setAttribute('aria-label', '이름 바꾸기');
  renameBtn.textContent = '✎';
  renameBtn.addEventListener('click', () => startFolderRename(li, f));

  li.appendChild(nameBtn);
  li.appendChild(renameBtn);
  return li;
}

function startFolderRename(li, f) {
  li.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'folder-rename-input';
  input.value = f.name;

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'icon-btn';
  saveBtn.setAttribute('aria-label', '저장');
  saveBtn.textContent = '✓';

  const commit = async () => {
    const newName = input.value.trim();
    if (newName && newName !== f.name) {
      try {
        await renameFolder(f.id, newName);
        f.name = newName;
      } catch (err) {
        console.error(err);
      }
    }
    if (f.id === currentFolderId) currentFolderNameEl.textContent = f.name;
    renderFolderModal();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') renderFolderModal();
  });
  saveBtn.addEventListener('click', commit);

  li.appendChild(input);
  li.appendChild(saveBtn);
  input.focus();
  input.select();
}

folderSwitchBtn.addEventListener('click', () => {
  renderFolderModal();
  folderModal.hidden = false;
});
closeFolderBtn.addEventListener('click', () => { folderModal.hidden = true; });
folderModal.addEventListener('click', (e) => {
  if (e.target === folderModal) folderModal.hidden = true;
});

newFolderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = newFolderInput.value.trim();
  if (!name) return;
  try {
    const ref = await addFolder(name);
    newFolderInput.value = '';
    currentFolderId = ref.id;
    await refreshFolders();
    renderFolderModal();
  } catch (err) {
    console.error(err);
  }
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
    await addWord(word, meaning, currentFolderId);
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
    words = await fetchActiveWords(currentFolderId);
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

  const info = document.createElement('div');
  info.className = 'w-info';
  const wordSpan = document.createElement('span');
  wordSpan.className = 'w-word';
  wordSpan.textContent = w.word;
  const meaningSpan = document.createElement('span');
  meaningSpan.className = 'w-meaning';
  meaningSpan.textContent = w.meaning;
  info.appendChild(wordSpan);
  info.appendChild(meaningSpan);
  li.appendChild(info);

  if (!isDeleted) {
    const actions = document.createElement('div');
    actions.className = 'w-actions';

    const checkBtnEl = document.createElement('button');
    checkBtnEl.type = 'button';
    checkBtnEl.className = 'w-check-btn';
    checkBtnEl.classList.toggle('checked', !!w.checked);
    checkBtnEl.setAttribute('aria-label', '체크 표시');
    checkBtnEl.textContent = '✓';
    checkBtnEl.addEventListener('click', async () => {
      const next = !w.checked;
      w.checked = next;
      checkBtnEl.classList.toggle('checked', next);
      try {
        await setChecked(w.id, next);
      } catch (err) {
        console.error(err);
        w.checked = !next;
        checkBtnEl.classList.toggle('checked', !next);
      }
    });

    const delBtnEl = document.createElement('button');
    delBtnEl.type = 'button';
    delBtnEl.className = 'w-del-btn';
    delBtnEl.setAttribute('aria-label', '삭제');
    delBtnEl.textContent = '✕';
    delBtnEl.addEventListener('click', async () => {
      if (!delBtnEl.classList.contains('confirming')) {
        delBtnEl.classList.add('confirming');
        setTimeout(() => delBtnEl.classList.remove('confirming'), 3000);
        return;
      }
      try {
        await softDeleteWord(w.id);
        li.remove();
        const total = wordListItems.children.length;
        wordCountEl.textContent = `${total}개`;
        listEmpty.hidden = total > 0;
      } catch (err) {
        console.error(err);
      }
    });

    actions.appendChild(checkBtnEl);
    actions.appendChild(delBtnEl);
    li.appendChild(actions);
  }

  return li;
}

showDeletedBtn.addEventListener('click', async () => {
  deletedModal.hidden = false;
  deletedListItems.innerHTML = '';
  deletedEmpty.hidden = true;
  try {
    const list = await fetchDeletedWords(currentFolderId);
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
    words = await fetchActiveWords(currentFolderId);
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

// ---------- Swipe to navigate: 왼쪽 = 다음 단어, 오른쪽 = 이전 단어 ----------
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

  const isForward = dx < 0;
  const canMove = Math.abs(dx) > 70 && (isForward || currentIndex > 0);

  if (canMove) {
    const flyX = dx > 0 ? window.innerWidth : -window.innerWidth;
    wordCard.style.transform = `translateX(${flyX}px) rotate(${dx / 30}deg)`;
    wordCard.style.opacity = '0';
    setTimeout(() => {
      currentIndex += isForward ? 1 : -1;
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

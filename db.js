// db.js — Firestore 데이터 접근 함수 모음
// 'words' 컬렉션의 각 문서: { word, meaning, checked, deleted, folderId, createdAt, deletedAt }
// deleted는 소프트 삭제 플래그입니다 — 삭제해도 문서는 지워지지 않고 흔적이 남습니다.
// 'folders' 컬렉션의 각 문서: { name, createdAt } — 단어를 묶어서 보관하는 폴더(단어장) 단위입니다.

import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, getDoc, setDoc, doc, updateDoc,
  query, where, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const wordsCol = collection(db, 'words');
const foldersCol = collection(db, 'folders');

export const DEFAULT_FOLDER_ID = 'default';

// 기본 폴더가 없으면 만들어두고, 폴더가 지정되지 않은 기존 단어들을 그 안으로 옮김
export async function ensureDefaultFolder() {
  const ref = doc(db, 'folders', DEFAULT_FOLDER_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { name: '기본 폴더', createdAt: serverTimestamp() });
  }

  const allWords = await getDocs(wordsCol);
  const migrations = [];
  allWords.forEach((d) => {
    if (!d.data().folderId) {
      migrations.push(updateDoc(doc(db, 'words', d.id), { folderId: DEFAULT_FOLDER_ID }));
    }
  });
  if (migrations.length) await Promise.all(migrations);
}

// 폴더 목록
export async function fetchFolders() {
  const snap = await getDocs(foldersCol);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  return list;
}

// 새 폴더 생성
export async function addFolder(name) {
  return addDoc(foldersCol, { name: name.trim(), createdAt: serverTimestamp() });
}

// 폴더 이름 변경
export async function renameFolder(id, name) {
  return updateDoc(doc(db, 'folders', id), { name: name.trim() });
}

// 새 단어 저장
export async function addWord(word, meaning, folderId) {
  return addDoc(wordsCol, {
    word: word.trim(),
    meaning: meaning.trim(),
    checked: false,
    deleted: false,
    folderId,
    createdAt: serverTimestamp(),
    deletedAt: null,
  });
}

// 활성 단어 목록 (추가창 리스트 / 암기창 셔플용)
// where 하나만 쓰고 정렬·폴더 필터링은 클라이언트에서 처리 — Firestore 복합 색인 설정이 필요 없게 하기 위함
export async function fetchActiveWords(folderId) {
  const q = query(wordsCol, where('deleted', '==', false));
  const snap = await getDocs(q);
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((w) => w.folderId === folderId);
  list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  return list;
}

// 삭제된 단어 목록 (추가창의 '삭제된 단어 보기'용)
export async function fetchDeletedWords(folderId) {
  const q = query(wordsCol, where('deleted', '==', true));
  const snap = await getDocs(q);
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((w) => w.folderId === folderId);
  list.sort((a, b) => toMillis(b.deletedAt) - toMillis(a.deletedAt));
  return list;
}

// 체크 여부 저장
export async function setChecked(id, checked) {
  return updateDoc(doc(db, 'words', id), { checked });
}

// 소프트 삭제 — deleted를 true로만 바꾸고 문서는 유지
export async function softDeleteWord(id) {
  return updateDoc(doc(db, 'words', id), { deleted: true, deletedAt: serverTimestamp() });
}

function toMillis(ts) {
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0;
}

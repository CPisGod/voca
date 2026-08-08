// db.js — Firestore 데이터 접근 함수 모음
// 'words' 컬렉션의 각 문서: { word, meaning, checked, deleted, createdAt, deletedAt }
// deleted는 소프트 삭제 플래그입니다 — 삭제해도 문서는 지워지지 않고 흔적이 남습니다.

import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, doc, updateDoc,
  query, where, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const wordsCol = collection(db, 'words');

// 새 단어 저장
export async function addWord(word, meaning) {
  return addDoc(wordsCol, {
    word: word.trim(),
    meaning: meaning.trim(),
    checked: false,
    deleted: false,
    createdAt: serverTimestamp(),
    deletedAt: null,
  });
}

// 활성 단어 목록 (추가창 리스트 / 암기창 셔플용)
// where 하나만 쓰고 정렬은 클라이언트에서 처리 — Firestore 복합 색인 설정이 필요 없게 하기 위함
export async function fetchActiveWords() {
  const q = query(wordsCol, where('deleted', '==', false));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  return list;
}

// 삭제된 단어 목록 (추가창의 '삭제된 단어 보기'용)
export async function fetchDeletedWords() {
  const q = query(wordsCol, where('deleted', '==', true));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

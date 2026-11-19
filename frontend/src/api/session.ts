// 브라우저 세션 번호(X-Session). 저장소의 "내 기록"이 이 값 기준이다.
// localStorage에 둬서 같은 브라우저면 새 탭·새로고침에도 기록이 이어진다. 예전 sessionStorage 값이 있으면 그대로 옮겨 온다.
const KEY = "nx-session";

export function sessionId(): string {
  try {
    let id = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    if (!id) id = `S-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "S-anon";
  }
}

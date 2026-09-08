"use client";
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

type TierId = "normal" | "boss";
type Special = "none" | "row" | "col" | "cross" | "boss";
type Asset = { id: string; name: string; url: string; emoji?: string };
type Cell = { id: string; type: number; special: Special };
type Group = { indices: number[]; direction: "row" | "col" };
type AccountUser = { id: string; username: string };
type CloudGame = {
  id: string;
  name: string;
  currentLevel: number;
  highestLevel: number;
  highestScore: number;
  normalAssets: string[];
  bossAsset: string | null;
};

const SIZE = 8;
const TYPES = 5;
const NORMAL_MOVES = 30;
const HARD_MOVES = 25;
const NORMAL_GOAL = 1500;
const HARD_GOAL = 2200;
const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const tiers: { id: TierId; name: string; note: string; help: string }[] = [
  { id: "normal", name: "普通图案", note: "基础棋子", help: "上传 5 张不同图片，作为游戏里的普通棋子" },
  { id: "boss", name: "Boss 图片", note: "五连生成", help: "五个连成一线时生成，可以上传 1 张 Boss 图片" },
];

const defaults: Record<TierId, Asset[]> = {
  normal: [
    { id: "nailong-strawberry", name: "草莓奶龙", url: "/defaults/nailong-1.jpg" },
    { id: "nailong-peach", name: "水蜜桃奶龙", url: "/defaults/nailong-2.jpg" },
    { id: "nailong-watermelon", name: "西瓜奶龙", url: "/defaults/nailong-3.jpg" },
    { id: "nailong-durian", name: "榴莲奶龙", url: "/defaults/nailong-4.jpg" },
    { id: "nailong-grape", name: "葡萄奶龙", url: "/defaults/nailong-5.jpg" },
  ],
  boss: [{ id: "nailong-boss", name: "奶龙 Boss", url: "/defaults/nailong-boss.jpg" }],
};

const cell = (type = Math.floor(Math.random() * TYPES), special: Special = "none"): Cell => ({
  id: Math.random().toString(36).slice(2), type, special,
});

function makeBoard() {
  let board: Cell[] = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    board = [];
    for (let index = 0; index < SIZE * SIZE; index++) {
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      const blocked = new Set<number>();
      if (col >= 2 && board[index - 1].type === board[index - 2].type) blocked.add(board[index - 1].type);
      if (row >= 2 && board[index - SIZE].type === board[index - SIZE * 2].type) blocked.add(board[index - SIZE].type);
      const choices = Array.from({ length: TYPES }, (_, i) => i).filter((type) => !blocked.has(type));
      board.push(cell(choices[Math.floor(Math.random() * choices.length)]));
    }
    if (hasMove(board)) return board;
  }
  return board;
}

function findGroups(board: Cell[]): Group[] {
  const groups: Group[] = [];
  for (let row = 0; row < SIZE; row++) {
    let start = 0;
    for (let col = 1; col <= SIZE; col++) {
      const same = col < SIZE && board[row * SIZE + col]?.type === board[row * SIZE + start]?.type;
      if (!same) {
        if (col - start >= 3) groups.push({ indices: Array.from({ length: col - start }, (_, i) => row * SIZE + start + i), direction: "row" });
        start = col;
      }
    }
  }
  for (let col = 0; col < SIZE; col++) {
    let start = 0;
    for (let row = 1; row <= SIZE; row++) {
      const same = row < SIZE && board[row * SIZE + col]?.type === board[start * SIZE + col]?.type;
      if (!same) {
        if (row - start >= 3) groups.push({ indices: Array.from({ length: row - start }, (_, i) => (start + i) * SIZE + col), direction: "col" });
        start = row;
      }
    }
  }
  return groups;
}

function hasMove(board: Cell[]) {
  if (board.some((item) => item.special === "boss")) return true;
  for (let index = 0; index < board.length; index++) {
    const candidates = [index + 1, index + SIZE].filter((next) => next < board.length && (next !== index + 1 || Math.floor(next / SIZE) === Math.floor(index / SIZE)));
    for (const next of candidates) {
      const swapped = [...board];
      [swapped[index], swapped[next]] = [swapped[next], swapped[index]];
      if (findGroups(swapped).length) return true;
    }
  }
  return false;
}

function shuffleBoard(board: Cell[]) {
  for (let attempt = 0; attempt < 250; attempt++) {
    const shuffled = [...board];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const target = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    if (!findGroups(shuffled).length && hasMove(shuffled)) return shuffled;
  }
  return makeBoard();
}

function collapse(board: (Cell | null)[]) {
  const next = [...board];
  for (let col = 0; col < SIZE; col++) {
    const kept: Cell[] = [];
    for (let row = SIZE - 1; row >= 0; row--) {
      const item = next[row * SIZE + col];
      if (item) kept.push(item);
    }
    for (let row = SIZE - 1, i = 0; row >= 0; row--, i++) next[row * SIZE + col] = kept[i] ?? cell();
  }
  return next as Cell[];
}

function resolveRound(board: Cell[], preferred?: number) {
  const groups = findGroups(board);
  if (!groups.length) return null;
  const clear = new Set<number>();
  const creations = new Map<number, Cell>();
  let made: Special | null = null;
  groups.forEach((group) => {
    group.indices.forEach((index) => clear.add(index));
    if (group.indices.length >= 4) {
      const at = preferred !== undefined && group.indices.includes(preferred) ? preferred : group.indices[Math.floor(group.indices.length / 2)];
      const nextSpecial: Special = group.indices.length >= 5 ? "boss" : group.direction;
      creations.set(at, cell(board[at].type, nextSpecial));
      if (!made || nextSpecial === "boss") made = nextSpecial;
    }
  });
  const horizontalThrees = groups.filter((group) => group.direction === "row" && group.indices.length === 3);
  const verticalThrees = groups.filter((group) => group.direction === "col" && group.indices.length === 3);
  horizontalThrees.forEach((horizontal) => {
    verticalThrees.forEach((vertical) => {
      const at = horizontal.indices.find((index) => vertical.indices.includes(index));
      if (at !== undefined) {
        creations.set(at, cell(board[at].type, "cross"));
        made = "cross";
      }
    });
  });
  const queue = [...clear];
  const visited = new Set<number>();
  while (queue.length) {
    const index = queue.pop()!;
    if (visited.has(index) || creations.has(index)) continue;
    visited.add(index);
    const item = board[index];
    if (item.special === "row") {
      const row = Math.floor(index / SIZE);
      for (let col = 0; col < SIZE; col++) if (!clear.has(row * SIZE + col)) { clear.add(row * SIZE + col); queue.push(row * SIZE + col); }
    } else if (item.special === "col") {
      const col = index % SIZE;
      for (let row = 0; row < SIZE; row++) if (!clear.has(row * SIZE + col)) { clear.add(row * SIZE + col); queue.push(row * SIZE + col); }
    } else if (item.special === "cross") {
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      for (let nextCol = 0; nextCol < SIZE; nextCol++) if (!clear.has(row * SIZE + nextCol)) { clear.add(row * SIZE + nextCol); queue.push(row * SIZE + nextCol); }
      for (let nextRow = 0; nextRow < SIZE; nextRow++) if (!clear.has(nextRow * SIZE + col)) { clear.add(nextRow * SIZE + col); queue.push(nextRow * SIZE + col); }
    } else if (item.special === "boss") {
      board.forEach((candidate, i) => { if (candidate.type === item.type && !clear.has(i)) { clear.add(i); queue.push(i); } });
    }
  }
  const gained = clear.size * 10 + Math.max(0, clear.size - 3) * 5;
  const emptied: (Cell | null)[] = board.map((item, index) => clear.has(index) ? null : item);
  creations.forEach((item, index) => { emptied[index] = item; });
  return { board: collapse(emptied), gained, made, clear };
}

export default function Home() {
  const [assets, setAssets] = useState<Record<TierId, Asset[]>>({ normal: [], boss: [] });
  const [activeTier, setActiveTier] = useState<TierId>("normal");
  const [started, setStarted] = useState(false);
  const [board, setBoard] = useState<Cell[]>(makeBoard);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(NORMAL_MOVES);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [gameName, setGameName] = useState("奶龙");
  const [level, setLevel] = useState(1);
  const [highestLevel, setHighestLevel] = useState(1);
  const [highestScore, setHighestScore] = useState(0);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [comboNotice, setComboNotice] = useState<{ id: number; count: number; score: number } | null>(null);
  const [shuffleNotice, setShuffleNotice] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [swapPair, setSwapPair] = useState<{ first: number; second: number } | null>(null);
  const [clearing, setClearing] = useState<Set<number>>(new Set());
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [cloudGames, setCloudGames] = useState<CloudGame[]>([]);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [assetUploading, setAssetUploading] = useState(false);
  const [assetMessage, setAssetMessage] = useState("");
  const urls = useRef<string[]>([]);
  const pointer = useRef<{ index: number; x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const comboTimer = useRef<number | null>(null);
  const shuffleTimer = useRef<number | null>(null);
  const comboId = useRef(0);

  useEffect(() => {
    const objectUrls = urls.current;
    const loadTimer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("custom-match3-progress") ?? "null");
        if (saved) {
          if (typeof saved.gameName === "string" && saved.gameName !== "我的") setGameName(saved.gameName.slice(0, 10));
          if (Number.isInteger(saved.level) && saved.level > 0) setLevel(saved.level);
          if (Number.isInteger(saved.highestLevel) && saved.highestLevel > 0) setHighestLevel(saved.highestLevel);
          if (Number.isInteger(saved.highestScore) && saved.highestScore >= 0) setHighestScore(saved.highestScore);
        }
      } catch { /* Ignore invalid local progress. */ }
      setProgressLoaded(true);
    }, 0);
    return () => {
      window.clearTimeout(loadTimer);
      objectUrls.forEach(URL.revokeObjectURL);
      if (comboTimer.current) window.clearTimeout(comboTimer.current);
      if (shuffleTimer.current) window.clearTimeout(shuffleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!progressLoaded) return;
    localStorage.setItem("custom-match3-progress", JSON.stringify({ gameName, level, highestLevel, highestScore }));
  }, [gameName, level, highestLevel, highestScore, progressLoaded]);

  useEffect(() => {
    if (!user || !activeGameId || !progressLoaded) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/games", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeGameId, name: gameName, currentLevel: level, highestLevel, highestScore }),
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [user, activeGameId, gameName, level, highestLevel, highestScore, progressLoaded]);

  const isHardLevel = level % 5 === 0;
  const goal = isHardLevel ? HARD_GOAL : NORMAL_GOAL;
  const gameTitle = `${gameName.trim() || "奶龙"}消消乐`;

  const currentAssets = (tier: TierId) => assets[tier].length ? assets[tier] : defaults[tier];
  const displayAsset = (item: Cell) => {
    if (item.special === "boss") return currentAssets("boss")[0] ?? defaults.boss[0];
    if (item.special === "row" || item.special === "col" || item.special === "cross") {
      const list = currentAssets("normal");
      return list[item.type % list.length];
    }
    const list = currentAssets("normal");
    return list[item.type % list.length];
  };

  function assetsFromGame(game: CloudGame): Record<TierId, Asset[]> {
    return {
      normal: game.normalAssets.map((url, index) => ({ id: `cloud-normal-${game.id}-${index}`, name: `图案 ${index + 1}`, url })),
      boss: game.bossAsset ? [{ id: `cloud-boss-${game.id}`, name: "Boss", url: game.bossAsset }] : [],
    };
  }

  async function uploadCloudAssets(tier: TierId, files: File[]) {
    if (!activeGameId) return;
    setAssetUploading(true);
    setAssetMessage("正在保存图片…");
    try {
      const form = new FormData();
      form.set("gameId", activeGameId);
      form.set("tier", tier);
      files.forEach((file) => form.append("files", file));
      const response = await fetch("/api/assets", { method: "POST", body: form });
      const data = await response.json() as { assets?: { key: string; url: string }[]; error?: string };
      if (!response.ok || !data.assets) {
        setAssetMessage(data.error ?? "图片保存失败，请稍后重试");
        return;
      }
      setAssets((current) => ({
        ...current,
        [tier]: data.assets!.map((asset, index) => ({ id: asset.key, name: tier === "boss" ? "Boss" : `图案 ${index + 1}`, url: asset.url })),
      }));
      setAssetMessage("图片已保存");
    } catch {
      setAssetMessage("图片保存失败，请稍后重试");
    } finally {
      setAssetUploading(false);
    }
  }

  function upload(tier: TierId, event: ChangeEvent<HTMLInputElement>) {
    const max = tier === "boss" ? 1 : 5;
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/")).slice(0, max);
    const next = files.map((file, index) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return { id: `${tier}-${file.name}-${file.lastModified}-${index}`, name: file.name, url };
    });
    setAssets((current) => ({ ...current, [tier]: next }));
    setAssetMessage(user && activeGameId ? "准备保存图片…" : "");
    if (user && activeGameId && files.length) void uploadCloudAssets(tier, files);
  }

  function startLevel(targetLevel = level) {
    const hard = targetLevel % 5 === 0;
    setLevel(targetLevel);
    setHighestLevel((current) => Math.max(current, targetLevel));
    setBoard(makeBoard());
    setMoves(hard ? HARD_MOVES : NORMAL_MOVES);
    setScore(0);
    setSelected(null);
    setStatus("playing");
    setComboNotice(null);
    setShuffleNotice(false);
    setAnimating(false);
    setSwapPair(null);
    setClearing(new Set());
    setStarted(true);
  }

  function finishMove(nextBoard: Cell[], gained: number) {
    const nextMoves = moves - 1;
    const nextScore = score + gained;
    const reshuffled = !hasMove(nextBoard);
    setBoard(reshuffled ? shuffleBoard(nextBoard) : nextBoard);
    if (reshuffled) {
      if (shuffleTimer.current) window.clearTimeout(shuffleTimer.current);
      setShuffleNotice(true);
      shuffleTimer.current = window.setTimeout(() => setShuffleNotice(false), 1300);
    }
    setMoves(nextMoves);
    setScore(nextScore);
    setHighestScore((current) => Math.max(current, nextScore));
    setSelected(null);
    if (nextScore >= goal) {
      setStatus("won");
      setHighestLevel((current) => Math.max(current, level));
    }
    else if (nextMoves <= 0) setStatus("lost");
    setSwapPair(null);
    setClearing(new Set());
    setAnimating(false);
  }

  function showCombo(count: number, comboScore: number) {
    if (comboTimer.current) window.clearTimeout(comboTimer.current);
    comboId.current += 1;
    setComboNotice({ id: comboId.current, count, score: comboScore });
    comboTimer.current = window.setTimeout(() => setComboNotice(null), 950);
  }

  async function animateDrop(nextBoard: Cell[]) {
    const before = new Map<string, { left: number; top: number }>();
    document.querySelectorAll<HTMLElement>("[data-cell-id]").forEach((element) => {
      if (element.dataset.cellId) before.set(element.dataset.cellId, { left: element.offsetLeft, top: element.offsetTop });
    });
    flushSync(() => {
      setClearing(new Set());
      setBoard(nextBoard);
    });
    const animations: Animation[] = [];
    document.querySelectorAll<HTMLElement>("[data-cell-id]").forEach((element) => {
      const previous = element.dataset.cellId ? before.get(element.dataset.cellId) : undefined;
      if (previous) {
        const x = previous.left - element.offsetLeft;
        const y = previous.top - element.offsetTop;
        if (x || y) animations.push(element.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: "translate(0, 0)" }], { duration: 380, easing: "cubic-bezier(.18,.78,.28,1)" }));
      } else {
        const distance = Math.min(180, element.offsetTop + element.offsetHeight + 24);
        animations.push(element.animate([{ transform: `translateY(-${distance}px) scale(.92)`, opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1 }], { duration: 420, easing: "cubic-bezier(.16,.82,.3,1)" }));
      }
    });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  }

  async function playCascades(startBoard: Cell[], preferred?: number, startingScore = 0) {
    let current = startBoard;
    let gained = startingScore;
    for (let round = 0; round < 12; round++) {
      const step = resolveRound(current, preferred);
      if (!step) break;
      if (round > 0) showCombo(round + 1, step.gained);
      setClearing(step.clear);
      await wait(300);
      await animateDrop(step.board);
      await wait(110);
      current = step.board;
      gained += step.gained;
      preferred = undefined;
    }
    finishMove(current, gained);
  }

  function trySwap(first: number, second: number) {
    if (status !== "playing" || animating) return;
    const adjacent = Math.abs(first - second) === SIZE || (Math.abs(first - second) === 1 && Math.floor(first / SIZE) === Math.floor(second / SIZE));
    if (!adjacent) { setSelected(second); return; }
    const swapped = [...board];
    [swapped[first], swapped[second]] = [swapped[second], swapped[first]];
    const a = swapped[first];
    const b = swapped[second];
    setAnimating(true);
    setSelected(null);
    setSwapPair({ first, second });
    setBoard(swapped);
    if (a.special === "boss" || b.special === "boss") {
      window.setTimeout(async () => {
        const bothBoss = a.special === "boss" && b.special === "boss";
        const bossIndex = a.special === "boss" ? first : second;
        const other = a.special === "boss" ? b : a;
        const clearIndices = new Set<number>();
        swapped.forEach((item, index) => { if (bothBoss || item.type === other.type || index === bossIndex) clearIndices.add(index); });
        setSwapPair(null);
        setClearing(clearIndices);
        window.setTimeout(async () => {
          if (bothBoss) {
            const fresh = makeBoard();
            await animateDrop(fresh);
            finishMove(fresh, swapped.length * 20);
            return;
          }
          const cleared = swapped.map((item, index) => clearIndices.has(index) ? null : item);
          const dropped = collapse(cleared);
          await animateDrop(dropped);
          await wait(110);
          await playCascades(dropped, undefined, clearIndices.size * 15);
        }, 260);
      }, 210);
      return;
    }
    const groups = findGroups(swapped);
    if (!groups.length) {
      window.setTimeout(() => {
        setBoard(board);
        window.setTimeout(() => {
          setSwapPair(null);
          setAnimating(false);
        }, 220);
      }, 210);
      return;
    }
    window.setTimeout(async () => {
      setSwapPair(null);
      await playCascades(swapped, second);
    }, 210);
  }

  function choose(index: number) {
    if (animating) return;
    if (swiped.current) { swiped.current = false; return; }
    if (selected === null) setSelected(index);
    else if (selected === index) setSelected(null);
    else trySwap(selected, index);
  }

  function pointerDown(index: number, event: PointerEvent<HTMLButtonElement>) {
    if (animating) return;
    pointer.current = { index, x: event.clientX, y: event.clientY };
    swiped.current = false;
  }

  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!pointer.current) return;
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) {
      const from = pointer.current.index;
      const row = Math.floor(from / SIZE);
      const col = from % SIZE;
      const to = Math.abs(dx) > Math.abs(dy) ? from + (dx > 0 ? 1 : -1) : from + (dy > 0 ? SIZE : -SIZE);
      const valid = to >= 0 && to < SIZE * SIZE && (Math.floor(to / SIZE) === row || to % SIZE === col);
      if (valid) trySwap(from, to);
      swiped.current = true;
    }
    pointer.current = null;
  }

  function motionClass(index: number) {
    if (!swapPair) return "";
    const source = index === swapPair.first ? swapPair.second : index === swapPair.second ? swapPair.first : null;
    if (source === null) return "";
    const difference = source - index;
    if (difference === 1) return "swapFromRight";
    if (difference === -1) return "swapFromLeft";
    if (difference === SIZE) return "swapFromBottom";
    return "swapFromTop";
  }

  function switchAuthMode(mode: "login" | "register") {
    setAuthMode(mode);
    setAuthMessage("");
  }

  async function loadCloudGames() {
    const response = await fetch("/api/games", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { games: CloudGame[] };
    setCloudGames(data.games);
    const game = data.games[0];
    if (game) {
      setActiveGameId(game.id);
      setGameName(game.name);
      setLevel(game.currentLevel);
      setHighestLevel(game.highestLevel);
      setHighestScore(game.highestScore);
      setAssets(assetsFromGame(game));
    }
  }

  async function restoreAccount() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { user: AccountUser };
      setUser(data.user);
      await loadCloudGames();
    } catch { /* The guest experience remains available when cloud storage is offline. */ }
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const timer = window.setTimeout(() => void restoreAccount(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = authUsername.trim();
    if (!/^[\p{L}\p{N}]+$/u.test(username)) {
      setAuthMessage("用户名只能包含中文、字母和数字");
      return;
    }
    if (authPassword.length < 8) {
      setAuthMessage("密码至少需要 8 位");
      return;
    }
    setAuthLoading(true);
    setAuthMessage("");
    try {
      const response = await fetch(`/api/auth/${authMode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: authPassword }),
      });
      const data = await response.json() as { user?: AccountUser; error?: string };
      if (!response.ok || !data.user) {
        setAuthMessage(data.error ?? "暂时无法完成，请稍后重试");
        return;
      }
      setUser(data.user);
      setAuthPassword("");
      await loadCloudGames();
      setAuthOpen(false);
    } catch {
      setAuthMessage("暂时无法连接账号服务");
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setCloudGames([]);
    setActiveGameId(null);
    setAuthOpen(false);
  }

  function selectCloudGame(game: CloudGame) {
    setActiveGameId(game.id);
    setGameName(game.name);
    setLevel(game.currentLevel);
    setHighestLevel(game.highestLevel);
    setHighestScore(game.highestScore);
    setAssets(assetsFromGame(game));
    setAssetMessage("");
    setStarted(false);
    setAuthOpen(false);
  }

  async function createCloudGame() {
    const response = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "奶龙" }),
    });
    if (!response.ok) return;
    const data = await response.json() as { game: CloudGame };
    setCloudGames((current) => [data.game, ...current]);
    selectCloudGame(data.game);
  }

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => setStarted(false)} aria-label="返回图片设置"><span className="brandMark">消</span><span>{gameTitle}</span></button>
        <div className="topActions"><span className="tinyPill">最高第 {highestLevel} 关</span>{started && <button className="ghostButton" onClick={() => setStarted(false)}>更换图片</button>}<button className={`loginButton ${user ? "signedIn" : ""}`} onClick={() => setAuthOpen(true)}>{user ? user.username : "登录 / 注册"}</button></div>
      </header>

      {!started ? (
        <section className="setupPage">
          <div className="studioCard">
            <div className="studioHeader"><div><h2>游戏设置</h2></div><button className="textButton" onClick={() => setAssets({ normal: [], boss: [] })}>恢复示例</button></div>
            <label className="nameField setupName"><span>游戏名称</span><div><input value={gameName} maxLength={10} onChange={(event) => setGameName(event.target.value.replace(/消消乐/g, "").slice(0, 10))} placeholder="例如：猫猫" /><b>消消乐</b></div><small>当前第 {level} 关 · 最高第 {highestLevel} 关</small></label>
            <div className="layerTabs" role="tablist">
              {tiers.map((tier) => <button key={tier.id} className={activeTier === tier.id ? "active" : ""} onClick={() => setActiveTier(tier.id)} role="tab"><span>{tier.name}</span><small>{tier.note}</small>{assets[tier.id].length > 0 && <b>{assets[tier.id].length}</b>}</button>)}
            </div>
            <div className="uploadPanel">
              <div className="uploadCopy"><div><h3>{tiers.find((tier) => tier.id === activeTier)?.name}</h3><p>{tiers.find((tier) => tier.id === activeTier)?.help}</p></div></div>
              <label className={`dropzone ${assetUploading ? "uploading" : ""}`}><input type="file" accept="image/*" multiple={activeTier !== "boss"} disabled={assetUploading} onChange={(event) => upload(activeTier, event)} /><span className="plus">＋</span><strong>{assetUploading ? "正在保存…" : assets[activeTier].length ? "重新选择图片" : "点击选择图片"}</strong><small>{activeTier === "boss" ? "选择 1 张方形图片" : "建议按相同顺序选择 5 张图片"}</small></label>
              {assetMessage && <p className="assetMessage" role="status">{assetMessage}</p>}
              <div className="previews">{currentAssets(activeTier).map((asset, index) => <div className="previewWrap" key={asset.id}><div className="previewTile">{asset.emoji ? <span>{asset.emoji}</span> : <img src={asset.url} alt={asset.name} />}</div><small>{activeTier === "boss" ? "Boss" : index + 1}</small></div>)}{!assets[activeTier].length && <p>当前使用示例图案</p>}</div>
            </div>
            <div className="studioFooter"><div><strong>{assets.normal.length + assets.boss.length || 6}</strong><span>张素材已就绪</span></div><button className="primaryButton" onClick={() => startLevel()}>开始游戏 <span>→</span></button></div>
          </div>
        </section>
      ) : (
        <section className="matchPage">
          <div className="matchHeader">
            <div><span className="eyebrow"><i /> {isHardLevel ? "困难关" : "普通关"}</span><h1>{gameTitle}</h1></div>
            <div className="scorePanel"><div className={isHardLevel ? "hardStat" : ""}><span>关卡</span><strong>{level}</strong></div><div><span>分数</span><strong>{score}</strong></div><div><span>剩余步数</span><strong>{moves}</strong></div><div><span>目标</span><strong>{goal}</strong></div></div>
          </div>
          <div className="matchGame">
            <div className={`matchBoard ${animating ? "animating" : ""}`} aria-label="三消游戏区域">
              {board.map((item, index) => {
                const asset = displayAsset(item);
                return <button key={item.id} data-cell-id={item.id} className={`matchCell ${selected === index ? "selected" : ""} ${item.special} ${motionClass(index)} ${clearing.has(index) ? "clearing" : ""}`} onClick={() => choose(index)} onPointerDown={(event) => pointerDown(index, event)} onPointerUp={pointerUp} aria-label={`第 ${Math.floor(index / SIZE) + 1} 行第 ${index % SIZE + 1} 列`}><span>{asset.emoji ? asset.emoji : <img src={asset.url} alt="" />}</span>{item.special === "row" && <i>↔</i>}{item.special === "col" && <i>↕</i>}{item.special === "cross" && <i>✚</i>}{item.special === "boss" && <i>★</i>}</button>;
              })}
              {comboNotice && <div key={comboNotice.id} className="comboNotice"><strong>连消 ×{comboNotice.count}</strong><span>+{comboNotice.score} 分</span></div>}
              {shuffleNotice && <div className="shuffleNotice">没有可走的组合，已自动洗牌</div>}
              {status !== "playing" && <div className="result"><span>{status === "won" ? "🎉" : "🙂"}</span><h2>{status === "won" ? "过关啦！" : "步数用完了"}</h2><p>本局得分 {score}{isHardLevel ? " · 困难关" : ""}</p><button className="primaryButton" onClick={() => startLevel(status === "won" ? level + 1 : level)}>{status === "won" ? "下一关" : "再试一次"}</button></div>}
            </div>
          </div>
        </section>
      )}

      {authOpen && <div className="authBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
        <section className="authDialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button className="authClose" onClick={() => setAuthOpen(false)} aria-label="关闭">×</button>
          {user ? <>
            <h2 id="auth-title">{user.username}</h2>
            <p>游戏名称和关卡进度会自动保存。</p>
            <div className="gameList">
              {cloudGames.map((game) => <button key={game.id} className={game.id === activeGameId ? "active" : ""} onClick={() => selectCloudGame(game)}><span>{game.name}消消乐</span><small>第 {game.currentLevel} 关 · 最高 {game.highestLevel} 关</small></button>)}
            </div>
            <button className="authSubmit" onClick={() => void createCloudGame()}>＋ 新建游戏</button>
            <button className="logoutButton" onClick={() => void logout()}>退出登录</button>
          </> : <>
            <h2 id="auth-title">{authMode === "login" ? "登录账号" : "注册账号"}</h2>
            <p>{authMode === "login" ? "登录后可保存游戏名称和关卡进度。" : "注册后可以创建并保存多个游戏。"}</p>
            <div className="authTabs">
              <button className={authMode === "login" ? "active" : ""} onClick={() => switchAuthMode("login")}>登录</button>
              <button className={authMode === "register" ? "active" : ""} onClick={() => switchAuthMode("register")}>注册</button>
            </div>
            <form className="authForm" onSubmit={submitAuth}>
              <label><span>用户名</span><input value={authUsername} onChange={(event) => setAuthUsername(event.target.value.replace(/\s/g, ""))} maxLength={16} autoComplete="username" placeholder="中文、字母或数字" /></label>
              <label><span>密码</span><input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={8} autoComplete={authMode === "login" ? "current-password" : "new-password"} placeholder="至少 8 位" /></label>
              {authMessage && <p className="authMessage" role="status">{authMessage}</p>}
              <button className="authSubmit" type="submit" disabled={authLoading}>{authLoading ? "请稍候…" : authMode === "login" ? "登录" : "创建账号"}</button>
            </form>
            <small>不登录也可以直接开始游戏</small>
          </>}
        </section>
      </div>}
    </main>
  );
}

/**
 * Doti.js - 核心逻辑修复与快捷键升级版（超瞬时跳转优化版）
 */

let originalQuestions = [];
let currentQuestions = [];
let wrongQuestions = [];
let favQuestions = [];
let currentIndex = 0;
let isSingleMode = true;
let isWrongMode = false;
let isFavMode = false;
let fileSignature = "";
let isAutoNext = false;

let userHistoryTracks = {};
let wrongHistoryTracks = {};
let favHistoryTracks = {};
const LETTER_ARR = ["A", "B", "C", "D"];

// --- 页面加载时自动读取上次的题库 ---
window.addEventListener("DOMContentLoaded", () => {
  const savedFilename = localStorage.getItem("quiz_last_filename");
  const savedData = localStorage.getItem("quiz_last_content");

  if (savedFilename && savedData) {
    document.getElementById("fileNameDisplay").innerText = savedFilename;
    processQuizData(savedData, savedFilename);
  }
});

function processQuizData(text, fileName) {
  if (!text || text.trim() === "") return;
  fileSignature = btoa(encodeURIComponent(fileName + "_" + text.length));

  const lines = text.split(/\r?\n/);
  originalQuestions = [];
  let validIndex = 0;

  lines.forEach((line) => {
    let trimmedLine = line.trim();
    if (!trimmedLine) return;

    const parts = trimmedLine.split("|").map((item) => item.trim());
    if (parts.length < 2) return;

    const q = parts[0];
    const ans = parts[parts.length - 1];
    if (
      ans === "标准答案" ||
      ans === "正确答案" ||
      ans === "答案" ||
      q.includes("题库的格式是")
    )
      return;

    const optionsParts = parts.slice(1, parts.length - 1);
    let typeBadge = "";
    let isMultiple = false;
    let isBlankType = false;

    if (optionsParts.length === 0) {
      isBlankType = true;
      typeBadge =
        '<span style="background:#f0932b;color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:6px;">填空题</span>';
    } else if (
      ans === "A" ||
      ans === "B" ||
      ans === "C" ||
      ans === "D" ||
      ans === "正确" ||
      ans === "错误"
    ) {
      if (
        optionsParts[1] === "错误" ||
        optionsParts[1] === "错" ||
        optionsParts.length === 2
      ) {
        typeBadge =
          '<span style="background:#3182ce;color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:6px;">判断题</span>';
      } else if (optionsParts.length > 2) {
        typeBadge =
          '<span style="background:#4cbd50;color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:6px;">单选题</span>';
      } else {
        isBlankType = true;
        typeBadge =
          '<span style="background:#f0932b;color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:6px;">填空题</span>';
      }
    } else if (ans.length > 1 && /^[A-D]+$/.test(ans)) {
      isMultiple = true;
      typeBadge =
        '<span style="background:#e056fd;color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:6px;">多选题</span>';
    } else {
      isBlankType = true;
      typeBadge =
        '<span style="background:#f0932b;color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:6px;">填空题</span>';
    }

    let mappedOptions = [];
    if (!isBlankType) {
      mappedOptions = optionsParts
        .map((optText, index) => {
          if (!optText) return null;
          let showText = optText;
          if (
            !optText.startsWith("A") &&
            !optText.startsWith("B") &&
            !optText.startsWith("C") &&
            !optText.startsWith("D") &&
            index < 4
          ) {
            showText = `${LETTER_ARR[index]}. ${optText}`;
          }
          return { text: showText, originalChar: LETTER_ARR[index] || "A" };
        })
        .filter((item) => item !== null);
      for (let i = mappedOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mappedOptions[i], mappedOptions[j]] = [
          mappedOptions[j],
          mappedOptions[i],
        ];
      }
    }

    originalQuestions.push({
      q,
      options: mappedOptions,
      ans,
      id: "q-" + fileSignature + "-" + validIndex,
      typeBadge,
      isMultiple,
      isBlankType,
      rawLine: trimmedLine,
    });
    validIndex++;
  });

  currentQuestions = JSON.parse(JSON.stringify(originalQuestions));
  const savedIndex = localStorage.getItem("bookmark_" + fileSignature);
  currentIndex =
    savedIndex !== null && parseInt(savedIndex) < currentQuestions.length
      ? parseInt(savedIndex)
      : 0;
  refreshDisplay();
}

// 初始化缓存
try {
  const savedWrong = localStorage.getItem("quiz_wrong_questions");
  if (savedWrong) {
    wrongQuestions = JSON.parse(savedWrong);
    document.getElementById("wrongCount").innerText = wrongQuestions.length;
  }
  const savedFav = localStorage.getItem("quiz_fav_questions");
  if (savedFav) {
    favQuestions = JSON.parse(savedFav);
    document.getElementById("favCount").innerText = favQuestions.length;
  }
  const savedTracks = localStorage.getItem("quiz_user_tracks");
  if (savedTracks) userHistoryTracks = JSON.parse(savedTracks);
  const savedWrongTracks = localStorage.getItem("quiz_wrong_tracks");
  if (savedWrongTracks) wrongHistoryTracks = JSON.parse(savedWrongTracks);
  const savedFavTracks = localStorage.getItem("quiz_fav_tracks");
  if (savedFavTracks) favHistoryTracks = JSON.parse(savedFavTracks);

  const savedAutoNext = localStorage.getItem("quiz_auto_next");
  if (savedAutoNext !== null) {
    isAutoNext = savedAutoNext === "true";
    document.getElementById("toggleAutoNextBtn").innerText = isAutoNext
      ? "自动跳转：开启"
      : "自动跳转：关闭";
  }
} catch (e) {
  console.error(e);
}

// 侧边栏折叠收起
const sidebar = document.getElementById("sidebarPanel");
const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
toggleSidebarBtn.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
  if (sidebar.classList.contains("collapsed")) {
    toggleSidebarBtn.innerText = "◀ 展开面板";
    document.body.style.paddingRight = "40px";
  } else {
    toggleSidebarBtn.innerText = "▶ 收起面板";
    document.body.style.paddingRight = "340px";
  }
});

// 自动跳转按钮
document
  .getElementById("toggleAutoNextBtn")
  .addEventListener("click", function () {
    isAutoNext = !isAutoNext;
    this.innerText = isAutoNext ? "自动跳转：开启" : "自动跳转：关闭";
    localStorage.setItem("quiz_auto_next", isAutoNext);
  });

// 主题颜色
const themeButtons = {
  themeNight: null,
  themeLight: "light",
  themeGreen: "green",
};
Object.keys(themeButtons).forEach((id) => {
  document.getElementById(id).addEventListener("click", () => {
    const theme = themeButtons[id];
    if (theme === null) document.body.removeAttribute("data-theme");
    else document.body.setAttribute("data-theme", theme);
  });
});

// 单题、整卷模式切换
document.getElementById("toggleModeBtn").addEventListener("click", () => {
  let list = isWrongMode
    ? wrongQuestions
    : isFavMode
      ? favQuestions
      : currentQuestions;
  if (list.length === 0) return;
  isSingleMode = !isSingleMode;

  const btn = document.getElementById("toggleModeBtn");
  const nav = document.getElementById("navPanel");

  if (isSingleMode) {
    btn.classList.remove("active");
    btn.innerText = "切换整卷模式";
    nav.style.display = "flex";
  } else {
    btn.classList.add("active");
    btn.innerText = "切换单题模式";
    nav.style.display = "none";
  }
  refreshDisplay();
});

// 书签设置
document.getElementById("setBookmarkBtn").addEventListener("click", () => {
  if (!fileSignature) return alert("请先上传一个题库！");
  localStorage.setItem("bookmark_" + fileSignature, currentIndex);
  document.getElementById("bookmarkTip").innerText =
    `第 ${currentIndex + 1} 题`;
  alert(`已标记当前位置：第 ${currentIndex + 1} 题！`);
});

// 错题本入口
const toggleWrongModeBtn = document.getElementById("toggleWrongModeBtn");
const wrongActionGroup = document.getElementById("wrongActionGroup");
toggleWrongModeBtn.addEventListener("click", () => {
  if (!isWrongMode && wrongQuestions.length === 0)
    return alert("错题本还是空的呢！");
  isWrongMode = !isWrongMode;
  isFavMode = false;
  currentIndex = 0;

  toggleWrongModeBtn.classList.toggle("active");
  toggleWrongModeBtn.innerHTML = isWrongMode
    ? "返回主题库"
    : `进入错题本 (<span id="wrongCount">${wrongQuestions.length}</span>)`;
  wrongActionGroup.style.display = isWrongMode ? "flex" : "none";

  toggleFavModeBtn.classList.remove("active");
  toggleFavModeBtn.innerHTML = `进入收藏夹 (<span id="favCount">${favQuestions.length}</span>)`;
  document.getElementById("favActionGroup").style.display = "none";

  refreshDisplay();
});

document.getElementById("clearWrongBtn").addEventListener("click", () => {
  if (!confirm("确定清空错题吗？")) return;
  wrongQuestions = [];
  wrongHistoryTracks = {};
  localStorage.setItem("quiz_wrong_questions", "[]");
  localStorage.setItem("quiz_wrong_tracks", "{}");
  document.getElementById("wrongCount").innerText = "0";
  isWrongMode = false;
  toggleWrongModeBtn.classList.remove("active");
  toggleWrongModeBtn.innerHTML = `进入错题本 (0)`;
  wrongActionGroup.style.display = "none";
  refreshDisplay();
});

document.getElementById("exportWrongBtn").addEventListener("click", () => {
  if (wrongQuestions.length === 0) return;
  exportToTxt(wrongQuestions, "错题本.txt");
});

// 收藏夹入口
const toggleFavModeBtn = document.getElementById("toggleFavModeBtn");
const favActionGroup = document.getElementById("favActionGroup");
toggleFavModeBtn.addEventListener("click", () => {
  if (!isFavMode && favQuestions.length === 0)
    return alert("收藏夹还是空的呢！");
  isFavMode = !isFavMode;
  isWrongMode = false;
  currentIndex = 0;

  toggleWrongModeBtn.classList.remove("active");
  toggleWrongModeBtn.innerHTML = `进入错题本 (<span id="wrongCount">${wrongQuestions.length}</span>)`;
  wrongActionGroup.style.display = "none";

  if (isFavMode) {
    toggleFavModeBtn.classList.add("active");
    toggleFavModeBtn.innerHTML = "返回主题库";
    favActionGroup.style.display = "flex";
  } else {
    toggleFavModeBtn.classList.remove("active");
    toggleFavModeBtn.innerHTML = `进入收藏夹 (<span id="favCount">${favQuestions.length}</span>)`;
    favActionGroup.style.display = "none";
  }
  refreshDisplay();
});

document.getElementById("clearFavBtn").addEventListener("click", () => {
  if (!confirm("确定清空收藏夹吗？")) return;
  favQuestions = [];
  favHistoryTracks = {};
  localStorage.setItem("quiz_fav_questions", "[]");
  localStorage.setItem("quiz_fav_tracks", "{}");
  document.getElementById("favCount").innerText = "0";
  isFavMode = false;
  toggleFavModeBtn.classList.remove("active");
  toggleFavModeBtn.innerHTML = `进入收藏夹 (0)`;
  favActionGroup.style.display = "none";
  refreshDisplay();
});

document.getElementById("exportFavBtn").addEventListener("click", () => {
  if (favQuestions.length === 0) return;
  exportToTxt(favQuestions, "收藏本.txt");
});

document.getElementById("clearTracksBtn").addEventListener("click", () => {
  if (!confirm(`确定清空当前作答红绿痕迹吗？`)) return;
  if (isWrongMode) {
    wrongHistoryTracks = {};
    localStorage.setItem("quiz_wrong_tracks", "{}");
  } else if (isFavMode) {
    favHistoryTracks = {};
    localStorage.setItem("quiz_fav_tracks", "{}");
  } else {
    userHistoryTracks = {};
    localStorage.setItem("quiz_user_tracks", "{}");
  }
  refreshDisplay();
});

function exportToTxt(list, filename) {
  let outputLines = list.map((q) => q.rawLine);
  let blob = new Blob([outputLines.join("\r\n")], {
    type: "text/plain;charset=utf-8",
  });
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toggleFavorite(qId, btnObj) {
  let list = isWrongMode
    ? wrongQuestions
    : isFavMode
      ? favQuestions
      : currentQuestions;
  let qObj = list.find((item) => item.id === qId);
  if (!qObj) return;

  let favIdx = favQuestions.findIndex((item) => item.id === qId);
  if (favIdx === -1) {
    favQuestions.push(JSON.parse(JSON.stringify(qObj)));
    btnObj.innerText = "★ 已收藏";
    btnObj.style.backgroundColor = "#ecc94b";
    btnObj.style.color = "#1a202c";
  } else {
    favQuestions.splice(favIdx, 1);
    if (favHistoryTracks[qId]) delete favHistoryTracks[qId];
    localStorage.setItem("quiz_fav_tracks", JSON.stringify(favHistoryTracks));
    btnObj.innerText = "☆ 收藏此题";
    btnObj.style.backgroundColor = "var(--btn-bg)";
    btnObj.style.color = "var(--btn-text)";
    if (isFavMode && currentIndex >= favQuestions.length && currentIndex > 0)
      currentIndex--;
  }

  localStorage.setItem("quiz_fav_questions", JSON.stringify(favQuestions));
  document.getElementById("favCount").innerText = favQuestions.length;
  buildAnswerCardMatrix(
    isWrongMode ? wrongQuestions : isFavMode ? favQuestions : currentQuestions,
  );
  if (isFavMode) refreshDisplay();
}

// 题库解析导入
document.getElementById("fileInput").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById("fileNameDisplay").innerText = file.name;
  fileSignature = btoa(encodeURIComponent(file.name + "_" + file.size));

  const reader = new FileReader();
  reader.onload = function (e) {
    const fileContent = e.target.result;

    localStorage.setItem("quiz_last_filename", file.name);
    localStorage.setItem("quiz_last_content", fileContent);

    const lines = fileContent.split(/\r?\n/);
    originalQuestions = [];
    let validIndex = 0;

    lines.forEach((line) => {
      let trimmedLine = line.trim();
      if (!trimmedLine) return;

      const parts = trimmedLine.split("|").map((item) => item.trim());
      if (parts.length < 2) return;

      const q = parts[0];
      const ans = parts[parts.length - 1];
      if (
        ans === "标准答案" ||
        ans === "正确答案" ||
        ans === "答案" ||
        q.includes("题库的格式是")
      )
        return;

      const optionsParts = parts.slice(1, parts.length - 1);
      let typeBadge = "";
      let isMultiple = false;
      let isBlankType = false;

      if (optionsParts.length === 0) {
        isBlankType = true;
        typeBadge =
          '<span style="background:#f0932b;color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:6px;">填空题</span>';
      } else if (
        ans === "A" ||
        ans === "B" ||
        ans === "C" ||
        ans === "D" ||
        ans === "正确" ||
        ans === "错误"
      ) {
        if (
          optionsParts[1] === "错误" ||
          optionsParts[1] === "错" ||
          optionsParts.length === 2
        ) {
          typeBadge =
            '<span style="background:#3182ce;color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:6px;">判断题</span>';
        } else if (optionsParts.length > 2) {
          typeBadge =
            '<span style="background:#4cbd50;color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:6px;">单选题</span>';
        } else {
          isBlankType = true;
          typeBadge =
            '<span style="background:#f0932b;color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:6px;">填空题</span>';
        }
      } else if (ans.length > 1 && /^[A-D]+$/.test(ans)) {
        isMultiple = true;
        typeBadge =
          '<span style="background:#e056fd;color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:6px;">多选题</span>';
      } else {
        isBlankType = true;
        typeBadge =
          '<span style="background:#f0932b;color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:6px;">填空题</span>';
      }

      let mappedOptions = [];
      if (!isBlankType) {
        mappedOptions = optionsParts
          .map((optText, index) => {
            if (!optText) return null;
            let showText = optText;
            if (
              !optText.startsWith("A") &&
              !optText.startsWith("B") &&
              !optText.startsWith("C") &&
              !optText.startsWith("D") &&
              index < 4
            ) {
              showText = `${LETTER_ARR[index]}. ${optText}`;
            }
            return { text: showText, originalChar: LETTER_ARR[index] || "A" };
          })
          .filter((item) => item !== null);

        for (let i = mappedOptions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [mappedOptions[i], mappedOptions[j]] = [
            mappedOptions[j],
            mappedOptions[i],
          ];
        }
      }

      originalQuestions.push({
        q,
        options: mappedOptions,
        ans,
        id: "q-" + fileSignature + "-" + validIndex,
        typeBadge,
        isMultiple,
        isBlankType,
        rawLine: trimmedLine,
      });
      validIndex++;
    });

    currentQuestions = JSON.parse(JSON.stringify(originalQuestions));
    isWrongMode = false;
    isFavMode = false;

    const savedIndex = localStorage.getItem("bookmark_" + fileSignature);
    if (savedIndex !== null && parseInt(savedIndex) < currentQuestions.length) {
      currentIndex = parseInt(savedIndex);
      document.getElementById("bookmarkTip").innerText =
        `第 ${currentIndex + 1} 题`;
    } else {
      currentIndex = 0;
      document.getElementById("bookmarkTip").innerText = "未标记";
    }

    refreshDisplay();
  };
  reader.readAsText(file, "UTF-8");
});

function refreshDisplay() {
  let list = isWrongMode
    ? wrongQuestions
    : isFavMode
      ? favQuestions
      : currentQuestions;
  const nav = document.getElementById("navPanel");

  if (list.length === 0) {
    document.getElementById("quizContainer").innerHTML =
      `<div style="text-align:center;color:#718096;padding:40px;">暂无数据。</div>`;
    nav.style.display = "none";
    document.getElementById("boxGrid").innerHTML = "";
    updateProgress();
    return;
  }

  if (isSingleMode) {
    nav.style.display = "flex";
    document.getElementById("quizContainer").innerHTML = buildQuestionHtml(
      list[currentIndex],
      currentIndex,
    );
    document.getElementById("prevBtn").disabled = currentIndex === 0;
    document.getElementById("nextBtn").disabled =
      currentIndex === list.length - 1;
  } else {
    nav.style.display = "none";
    document.getElementById("quizContainer").innerHTML = list
      .map((q, i) => buildQuestionHtml(q, i))
      .join("");
  }

  restoreAnswering痕迹(list);
  buildAnswerCardMatrix(list);
  updateProgress();
}

function buildQuestionHtml(qObj, displayIdx) {
  let optionsHtml = "";

  if (qObj.isBlankType) {
    optionsHtml = `
      <div class="blank-container" id="blank-panel-${qObj.id}">
        <input type="text" class="blank-input" id="input-${qObj.id}" placeholder="输入填空答案后点击右侧核对..." />
        <button class="nav-btn verify-blank-btn" style="margin-top:5px; padding:8px;" onclick="checkBlankAnswer('${qObj.id}')">核对填空题答案</button>
        <div class="blank-result-text" style="display:none; padding:12px; margin-top:8px; border-radius:8px; font-size:15px; font-weight:600;"></div>
      </div>
    `;
  } else {
    optionsHtml = `<ul class="options" data-id="${qObj.id}" data-ans="${qObj.ans}" data-multiple="${qObj.isMultiple}">`;
    qObj.options.forEach((opt) => {
      optionsHtml += `<li data-char="${opt.originalChar}" onclick="check(this, '${opt.originalChar}')">${opt.text}</li>`;
    });
    optionsHtml += "</ul>";

    if (qObj.isMultiple) {
      optionsHtml += `<button class="nav-btn submit-mult-btn" style="margin-top:12px; padding:8px 16px; font-size:14px; border-radius:6px;" onclick="submitMultiple(this)">确认选择</button>`;
    }
  }

  let isFav = favQuestions.some((item) => item.id === qObj.id);
  let favStyle = isFav
    ? "background-color:#ecc94b; color:#1a202c; border-color:#ecc94b;"
    : "";
  let favText = isFav ? "★ 已收藏" : "☆ 收藏此题";

  return `
    <div class="question" id="box-${qObj.id}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
          <p style="margin:0; flex:1;">${qObj.typeBadge}<span>${displayIdx + 1}</span>. ${qObj.q}</p>
          <button class="action-btn" style="width:auto; padding:5px 10px; font-size:12px; margin-left:10px; ${favStyle}" onclick="toggleFavorite('${qObj.id}', this)">${favText}</button>
        </div>
        ${optionsHtml}
    </div>
  `;
}

// 恢复作答痕迹修复
function restoreAnswering痕迹(list) {
  let targetTracks = isWrongMode
    ? wrongHistoryTracks
    : isFavMode
      ? favHistoryTracks
      : userHistoryTracks;

  list.forEach((qObj) => {
    let track = targetTracks[qObj.id];
    if (!track) return; 

    if (qObj.isBlankType) {
      let panel = document.getElementById(`blank-panel-${qObj.id}`);
      let inputEl = document.getElementById(`input-${qObj.id}`);
      if (panel && inputEl) {
        inputEl.value = track.userChoice[0] === "EMPTY" ? "" : track.userChoice[0];
        inputEl.disabled = true;
        let vBtn = panel.querySelector(".verify-blank-btn");
        if (vBtn) vBtn.style.display = "none";
        let resBox = panel.querySelector(".blank-result-text");
        resBox.style.display = "block";
        if (track.status === "correct") {
          resBox.style.backgroundColor = "var(--correct-bg)";
          resBox.style.color = "var(--correct-text)";
          resBox.innerText = `恭喜答对！参考答案：${qObj.ans}`;
        } else {
          resBox.style.backgroundColor = "var(--wrong-bg)";
          resBox.style.color = "var(--wrong-text)";
          resBox.innerText = `回答错误。你的答案: "${inputEl.value || "未填写"}" | 正确参考答案: "${qObj.ans}"`;
        }
      }
      return; 
    }

    let qBox = document.getElementById(`box-${qObj.id}`);
    if (!qBox) return;
    
    let ul = qBox.querySelector(".options");
    if (!ul) return;
    ul.classList.add("answered");
    let btn = qBox.querySelector(".submit-mult-btn");
    if (btn) btn.style.display = "none";

    Array.from(ul.children).forEach((li) => {
      let itemChar = li.getAttribute("data-char");
      if (qObj.isMultiple) {
        if (track.userChoice.includes(itemChar) && !qObj.ans.includes(itemChar))
          li.classList.add("wrong");
        else if (qObj.ans.includes(itemChar)) li.classList.add("correct");
      } else {
        if (track.userChoice.includes(itemChar))
          li.classList.add(track.status === "correct" ? "correct" : "wrong");
        else if (itemChar === qObj.ans) li.classList.add("correct");
      }
    });
  });
}

function buildAnswerCardMatrix(list) {
  const grid = document.getElementById("boxGrid");
  grid.innerHTML = "";

  const container = document.createElement("div");
  container.className = "card-matrix-container";
  grid.appendChild(container);

  let correctCount = 0,
    wrongCount = 0,
    unsolvedCount = 0;
  let targetTracks = isWrongMode
    ? wrongHistoryTracks
    : isFavMode
      ? favHistoryTracks
      : userHistoryTracks;

  const categorized = { 单选题: [], 多选题: [], 判断题: [], 填空题: [] };
  list.forEach((qObj, idx) => {
    let typeStr = "单选题";
    if (qObj.typeBadge.includes("多选题")) typeStr = "多选题";
    else if (qObj.typeBadge.includes("判断题")) typeStr = "判断题";
    else if (qObj.typeBadge.includes("填空题")) typeStr = "填空题";
    categorized[typeStr].push({ qObj, realIdx: idx });
  });

  for (const [typeName, items] of Object.entries(categorized)) {
    if (items.length === 0) continue;

    const blockWrapper = document.createElement("div");
    blockWrapper.className = "category-block-wrapper";

    const rowTitle = document.createElement("div");
    rowTitle.className = "category-row-title";
    rowTitle.innerText = `${typeName} (${items.length})`;
    blockWrapper.appendChild(rowTitle);

    const subGrid = document.createElement("div");
    subGrid.className = "box-grid";

    items.forEach(({ qObj, realIdx }) => {
      const box = document.createElement("div");
      box.className = "grid-box";
      box.innerText = realIdx + 1;

      if (isSingleMode && realIdx === currentIndex)
        box.classList.add("current-view");

      let hasFav = favQuestions.some((item) => item.id === qObj.id);
      if (hasFav) box.style.borderColor = "#ecc94b";

      let track = targetTracks[qObj.id];
      if (track) {
        if (track.status === "correct") {
          box.classList.add("status-correct");
          correctCount++;
        } else {
          box.classList.add("status-wrong");
          wrongCount++;
        }
      } else {
        unsolvedCount++;
      }

      box.addEventListener("click", () => {
        if (isSingleMode) {
          currentIndex = realIdx;
          refreshDisplay();
        } else {
          document
            .getElementById(`box-${qObj.id}`)
            .scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });

      subGrid.appendChild(box);
    });

    blockWrapper.appendChild(subGrid);
    container.appendChild(blockWrapper);
  }

  document.getElementById("statCorrect").innerText = correctCount;
  document.getElementById("statWrong").innerText = wrongCount;
  document.getElementById("statUnsolved").innerText = unsolvedCount;
}

function updateProgress() {
  const text = document.getElementById("progressText");
  let list = isWrongMode
    ? wrongQuestions
    : isFavMode
      ? favQuestions
      : currentQuestions;
  let prefix = isWrongMode
    ? "【错题本】"
    : isFavMode
      ? "【收藏夹】"
      : "【主题库】";
  if (list.length === 0) {
    text.innerText = `${prefix} 暂无题目`;
    return;
  }
  text.innerText = isSingleMode
    ? `${prefix} 第 ${currentIndex + 1} 题 / 共 ${list.length} 题`
    : `${prefix} 整卷模式 (共 ${list.length} 题)`;
}

function addToWrongList(qId) {
  let fullQuestion =
    originalQuestions.find((item) => item.id === qId) ||
    wrongQuestions.find((item) => item.id === qId) ||
    favQuestions.find((item) => item.id === qId);
  if (fullQuestion) {
    let exists = wrongQuestions.some(
      (item) => item.rawLine === fullQuestion.rawLine,
    );
    if (!exists) {
      wrongQuestions.push(JSON.parse(JSON.stringify(fullQuestion)));
      localStorage.setItem(
        "quiz_wrong_questions",
        JSON.stringify(wrongQuestions),
      );
      document.getElementById("wrongCount").innerText = wrongQuestions.length;
    }
  }
}

// 监听键盘快捷键 A/D 切换
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    return;
  }

  let list = isWrongMode
    ? wrongQuestions
    : isFavMode
      ? favQuestions
      : currentQuestions;
  if (list.length === 0) return;

  const keyLower = e.key.toLowerCase();

  if (keyLower === "a" && currentIndex > 0) {
    currentIndex--;
    refreshDisplay();
    return;
  } else if (keyLower === "d" && currentIndex < list.length - 1) {
    currentIndex++;
    refreshDisplay();
    return;
  }
});

// 导出备份功能
document.getElementById("exportBackupBtn").addEventListener("click", () => {
  if (!fileSignature && originalQuestions.length === 0) {
    return alert("当前没有数据可备份！");
  }

  const backupData = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    lastFilename: document.getElementById("fileNameDisplay").innerText,
    originalQuestions: originalQuestions,
    wrongQuestions: wrongQuestions,
    favQuestions: favQuestions,
    userHistoryTracks: userHistoryTracks,
    wrongHistoryTracks: wrongHistoryTracks,
    favHistoryTracks: favHistoryTracks,
    bookmarks: {},
  };

  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("bookmark_")) {
      backupData.bookmarks[key] = localStorage.getItem(key);
    }
  });

  const blob = new Blob([JSON.stringify(backupData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Doti刷题备份_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert("✅ 完整备份已下载！请妥善保存该文件。");
});

// 恢复备份功能
document
  .getElementById("importBackupInput")
  .addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const backup = JSON.parse(event.target.result);

        if (!backup.version) {
          return alert("❌ 这不是有效的 Doti 备份文件！");
        }

        if (backup.originalQuestions)
          originalQuestions = backup.originalQuestions;
        if (backup.wrongQuestions) wrongQuestions = backup.wrongQuestions;
        if (backup.favQuestions) favQuestions = backup.favQuestions;
        if (backup.userHistoryTracks)
          userHistoryTracks = backup.userHistoryTracks;
        if (backup.wrongHistoryTracks)
          wrongHistoryTracks = backup.wrongHistoryTracks;
        if (backup.favHistoryTracks) favHistoryTracks = backup.favHistoryTracks;

        if (backup.bookmarks) {
          Object.keys(backup.bookmarks).forEach((key) => {
            localStorage.setItem(key, backup.bookmarks[key]);
          });
        }

        localStorage.setItem(
          "quiz_wrong_questions",
          JSON.stringify(wrongQuestions),
        );
        localStorage.setItem(
          "quiz_fav_questions",
          JSON.stringify(favQuestions),
        );
        localStorage.setItem(
          "quiz_user_tracks",
          JSON.stringify(userHistoryTracks),
        );
        localStorage.setItem(
          "quiz_wrong_tracks",
          JSON.stringify(wrongHistoryTracks),
        );
        localStorage.setItem(
          "quiz_fav_tracks",
          JSON.stringify(favHistoryTracks),
        );

        document.getElementById("wrongCount").innerText = wrongQuestions.length;
        document.getElementById("favCount").innerText = favQuestions.length;

        alert(
          `✅ 备份恢复成功！\n\n题库：${originalQuestions.length} 题\n收藏：${favQuestions.length} 题\n错题：${wrongQuestions.length} 题`,
        );

        isWrongMode = false;
        isFavMode = false;
        currentIndex = 0;
        refreshDisplay();
      } catch (err) {
        alert("❌ 恢复失败：文件格式错误或已损坏");
        console.error(err);
      }
    };
    reader.readAsText(file);
  });

// ==================== 核心交互函数释放至全局作用域（跳转间隔缩短为100ms） ====================

// 1. 填空题核对与跳转
function checkBlankAnswer(qId) {
  const panel = document.getElementById(`blank-panel-${qId}`);
  const inputEl = document.getElementById(`input-${qId}`);
  if (!panel || !inputEl) return;

  let list = isWrongMode
    ? wrongQuestions
    : isFavMode
      ? favQuestions
      : currentQuestions;
  let qObj = list.find((item) => item.id === qId);
  if (!qObj) return;

  let userText = inputEl.value.trim();
  let rightText = qObj.ans.trim();
  let isCorrect = userText === rightText;

  let trackData = {
    status: isCorrect ? "correct" : "wrong",
    userChoice: [userText || "EMPTY"],
  };

  if (isWrongMode) {
    wrongHistoryTracks[qId] = trackData;
    localStorage.setItem(
      "quiz_wrong_tracks",
      JSON.stringify(wrongHistoryTracks),
    );
  } else if (isFavMode) {
    favHistoryTracks[qId] = trackData;
    localStorage.setItem("quiz_fav_tracks", JSON.stringify(favHistoryTracks));
  } else {
    userHistoryTracks[qId] = trackData;
    localStorage.setItem("quiz_user_tracks", JSON.stringify(userHistoryTracks));
  }

  inputEl.disabled = true;
  panel.querySelector(".verify-blank-btn").style.display = "none";

  let resultBox = panel.querySelector(".blank-result-text");
  resultBox.style.display = "block";

  if (isCorrect) {
    resultBox.style.backgroundColor = "var(--correct-bg)";
    resultBox.style.color = "var(--correct-text)";
    resultBox.innerText = `恭喜答对！参考答案：${qObj.ans}`;
    // 开启自动跳转且未到达最后一题时，100ms 快速跳转
    if (isAutoNext && isSingleMode && currentIndex < list.length - 1) {
      setTimeout(() => {
        currentIndex++;
        refreshDisplay();
      }, 100);
    }
  } else {
    resultBox.style.backgroundColor = "var(--wrong-bg)";
    resultBox.style.color = "var(--wrong-text)";
    resultBox.innerText = `回答错误。你的答案: "${userText || "未填写"}" | 正确参考答案: "${qObj.ans}"`;
    addToWrongList(qId);
  }
  buildAnswerCardMatrix(list);
}

// 2. 单选/判断题核对与跳转
function check(el, choice) {
  const parent = el.parentNode;
  if (parent.classList.contains("answered")) return;

  const isMultiple = parent.getAttribute("data-multiple") === "true";
  const ans = parent.getAttribute("data-ans");
  const qId = parent.getAttribute("data-id");
  let list = isWrongMode
    ? wrongQuestions
    : isFavMode
      ? favQuestions
      : currentQuestions;

  if (isMultiple) {
    el.classList.toggle("active-choice");
  } else {
    parent.classList.add("answered");

    let pureEditText = el.innerText.replace(/^[A-D]\.\s*/, "").trim();
    let isCorrect =
      choice === ans || el.innerText.trim() === ans || pureEditText === ans;

    let trackData = {
      status: isCorrect ? "correct" : "wrong",
      userChoice: [choice],
    };

    if (isWrongMode) {
      wrongHistoryTracks[qId] = trackData;
      localStorage.setItem(
        "quiz_wrong_tracks",
        JSON.stringify(wrongHistoryTracks),
      );
    } else if (isFavMode) {
      favHistoryTracks[qId] = trackData;
      localStorage.setItem("quiz_fav_tracks", JSON.stringify(favHistoryTracks));
    } else {
      userHistoryTracks[qId] = trackData;
      localStorage.setItem(
        "quiz_user_tracks",
        JSON.stringify(userHistoryTracks),
      );
    }

    if (isCorrect) {
      el.classList.add("correct");
      // 开启自动跳转且未到达最后一题时，100ms 快速跳转
      if (isAutoNext && isSingleMode && currentIndex < list.length - 1) {
        setTimeout(() => {
          currentIndex++;
          refreshDisplay();
        }, 100);
      }
    } else {
      el.classList.add("wrong");
      addToWrongList(qId);
      Array.from(parent.children).forEach((li) => {
        let c = li.getAttribute("data-char");
        let liPureText = li.innerText.replace(/^[A-D]\.\s*/, "").trim();
        if (c === ans || li.innerText.trim() === ans || liPureText === ans)
          li.classList.add("correct");
      });
    }
    buildAnswerCardMatrix(list);
  }
}

// 3. 多选题核对与跳转
function submitMultiple(btnObj) {
  const parent = btnObj.parentNode.querySelector(".options");
  if (parent.classList.contains("answered")) return;

  const qId = parent.getAttribute("data-id");
  let list = isWrongMode
    ? wrongQuestions
    : isFavMode
      ? favQuestions
      : currentQuestions;
  let qObj = list.find((item) => item.id === qId);
  if (!qObj) return;

  let userChoices = [];
  Array.from(parent.children).forEach((li) => {
    if (li.classList.contains("active-choice"))
      userChoices.push(li.getAttribute("data-char"));
  });
  userChoices.sort();
  const userAnsStr = userChoices.join("");
  const rightAnsStr = qObj.ans.split("").sort().join("");
  let isCorrect = userAnsStr === rightAnsStr;

  parent.classList.add("answered");
  btnObj.style.display = "none";
  let trackData = {
    status: isCorrect ? "correct" : "wrong",
    userChoice: userChoices,
  };

  if (isWrongMode) {
    wrongHistoryTracks[qId] = trackData;
    localStorage.setItem(
      "quiz_wrong_tracks",
      JSON.stringify(wrongHistoryTracks),
    );
  } else if (isFavMode) {
    favHistoryTracks[qId] = trackData;
    localStorage.setItem("quiz_fav_tracks", JSON.stringify(favHistoryTracks));
  } else {
    userHistoryTracks[qId] = trackData;
    localStorage.setItem("quiz_user_tracks", JSON.stringify(userHistoryTracks));
  }

  Array.from(parent.children).forEach((li) => {
    li.classList.remove("active-choice");
    let itemChar = li.getAttribute("data-char");
    if (userChoices.includes(itemChar) && !qObj.ans.includes(itemChar))
      li.classList.add("wrong");
    else if (qObj.ans.includes(itemChar)) li.classList.add("correct");
  });

  if (!isCorrect) {
    addToWrongList(qId);
  } else {
    // 开启自动跳转且未到达最后一题时，100ms 快速跳转
    if (isAutoNext && isSingleMode && currentIndex < list.length - 1) {
      setTimeout(() => {
        currentIndex++;
        refreshDisplay();
      }, 100);
    }
  }
  buildAnswerCardMatrix(list);
}

// 4. 原有上下题按钮监听事件
document.getElementById("prevBtn").addEventListener("click", () => {
  if (currentIndex > 0) {
    currentIndex--;
    refreshDisplay();
  }
});
document.getElementById("nextBtn").addEventListener("click", () => {
  let list = isWrongMode
    ? wrongQuestions
    : isFavMode
      ? favQuestions
      : currentQuestions;
  if (currentIndex < list.length - 1) {
    currentIndex++;
    refreshDisplay();
  }
});
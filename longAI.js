// ==UserScript==
// @name         크랙 AI 답변 커스텀(제미나이API & Firebase 통합)
// @namespace    http://tampermonkey.net/
// @version      3.3.1
// @description  명령어 퀄리티 극대화, 설정 버튼 반응형(모바일) UI 패치, Firebase Vertex API 지원 추가
// @match        https://crack.wrtn.ai/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function () {
  "use strict";

  const API_BASE = "https://crack-api.wrtn.ai/crack-gen";

  let generatedHistory = [];
  let historyIndex = -1;

  function getChatRoomId() {
    const match = location.pathname.match(
      /\/stories\/[^/]+\/episodes\/([^/]+)/,
    );
    return match ? match[1] : "global_room";
  }

  // =============================================
  // 1. 스타일 (버튼 반응형 UI 추가)
  // =============================================
  GM_addStyle(`
        /* 상단 버튼들 */
        .crack-pure-settings {
            height: 2.25rem; padding: 0 0.75rem; border-radius: 8px; border: 1px solid hsl(var(--border));
            background-color: transparent !important; color: hsl(var(--foreground));
            font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center;
            gap: 0.4rem; cursor: pointer; margin-right: 4px; transition: all 0.2s;
            white-space: nowrap; overflow: hidden;
        }
        .crack-pure-settings:hover { background-color: hsl(var(--accent)) !important; }

        /* 🌟 창 크기 줄어들 때 글씨 숨기고 이모지만 남기는 반응형 CSS */
        @media (max-width: 768px) {
            .setting-btn-text { display: none; }
            .crack-pure-settings { padding: 0 0.5rem; gap: 0; }
        }

        .crack-right-group { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .crack-pure-magic {
            height: 1.75rem; width: 1.75rem; min-width: 1.75rem; border-radius: 9999px;
            background-color: #6A3DE8; color: white; display: inline-flex; align-items: center; justify-content: center;
            cursor: pointer; border: none; padding: 0; box-shadow: 0 4px 6px var(--shadow-md); transition: all 0.2s;
        }
        .crack-pure-magic:hover { transform: scale(1.1); background-color: #5228CC; }

        .crack-history-widget {
            display: none; align-items: center; gap: 8px;
            background: var(--bg_elevated_primary); border: 1px solid var(--border);
            border-radius: 12px; padding: 4px 10px; font-size: 13px; font-weight: bold; color: var(--text_primary);
        }
        .crack-history-btn { cursor: pointer; color: var(--text_secondary); transition: 0.2s; user-select: none; }
        .crack-history-btn:hover { color: var(--text_brand); transform: scale(1.1); }

        #crack-ai-panel {
            position: fixed; top: 80px; right: 30px; z-index: 999999;
            width: min(560px, 90vw); max-height: 85vh;
            background-color: var(--bg_screen); border: 1px solid var(--border); border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: var(--text_primary); font-family: var(--font-sans);
            display: none; flex-direction: column; overflow: hidden;
        }

        .panel-header {
            padding: 16px 20px; background-color: var(--bg_elevated_primary);
            border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;
            cursor: move; user-select: none;
        }
        .panel-title { font-size: 16px; font-weight: 800; color: var(--text_brand); display: flex; align-items: center; gap: 6px; }
        .panel-close { cursor: pointer; font-size: 18px; color: var(--text_secondary); transition: 0.2s; padding: 0 5px; }
        .panel-close:hover { color: #ff4444; transform: scale(1.1); }

        .panel-content { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 24px; }
        .panel-content::-webkit-scrollbar { width: 6px; }
        .panel-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }

        .setting-group { display: flex; flex-direction: column; gap: 8px; }
        .setting-label { font-size: 12px; color: var(--text_secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;}

        .info-box { background: var(--bg_elevated_primary); border: 1px solid var(--border); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .info-title { font-size: 12px; color: var(--text_action_blue_primary); font-weight: 800; display: flex; align-items: center; gap: 4px; }
        .info-text { font-size: 13px; color: var(--text_primary); line-height: 1.5; word-break: break-all; white-space: pre-wrap; }

        .expand-input {
            width: 100%; box-sizing: border-box; padding: 12px;
            background-color: var(--bg_elevated_secondary); color: var(--text_primary);
            border: 1px solid var(--border); border-radius: 8px; font-size: 14px; outline: none; transition: 0.2s;
        }
        .expand-input:focus { border-color: var(--text_brand); }
        textarea.expand-input { resize: vertical; line-height: 1.5; }

        .radio-group { display: flex; gap: 16px; align-items: center; font-size: 14px; }
        .radio-group label { cursor: pointer; display: flex; align-items: center; gap: 6px; }

        .tone-container { display: flex; flex-wrap: wrap; gap: 8px; }
        .tone-chip {
            padding: 6px 14px; border: 1px solid var(--border); border-radius: 20px;
            font-size: 13px; cursor: pointer; color: var(--text_secondary); background: var(--bg_elevated_primary); transition: 0.2s;
        }
        .tone-chip:hover { border-color: var(--text_secondary); }
        .tone-chip.active { background-color: #6A3DE8; color: white; border-color: #6A3DE8; font-weight: bold; }

        .acc-wrapper { display: flex; flex-direction: column; gap: 0; }
        .acc-header {
            font-size: 14px; font-weight: 800; color: var(--text_primary); background: var(--bg_elevated_primary);
            padding: 14px; border-radius: 8px; cursor: pointer; border: 1px solid var(--border);
            display: flex; justify-content: space-between; align-items: center; transition: 0.2s;
        }
        .acc-header:hover { background: var(--bg_elevated_secondary); }
        .acc-content {
            display: none; padding: 16px; border: 1px solid var(--border); border-top: none;
            border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; background: var(--bg_elevated_primary);
            flex-direction: column; gap: 16px;
        }
        .acc-content.open { display: flex; }

        .slots-container { display: flex; flex-direction: column; gap: 8px; }
        .lore-details { border-bottom: 1px solid var(--border); padding-bottom: 12px; }
        .lore-details:last-child { border-bottom: none; padding-bottom: 0; }
        .lore-summary { font-size: 13px; font-weight: 700; color: var(--text_primary); cursor: pointer; display: flex; align-items: center; gap: 8px; margin-bottom: 4px; list-style: none; }
        .lore-summary::-webkit-details-marker { display: none; }
        .lore-summary::before { content: '▶'; font-size: 10px; color: var(--text_secondary); transition: 0.2s; }
        .lore-details[open] .lore-summary::before { transform: rotate(90deg); }
        .lore-summary label { cursor: pointer; display: flex; align-items: center; gap: 6px; margin: 0; }

        .ego-slider-box { display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--bg_elevated_primary); border: 1px solid var(--border); border-radius: 8px; }
        .ego-desc { font-size: 11px; text-align: center; color: var(--text_brand); font-weight: bold; }

        .btn-save { width: 100%; background: var(--surface_brand_primary); color: white; border: none; padding: 14px; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 15px; transition: 0.2s; letter-spacing: 1px; }
        .btn-save:hover { opacity: 0.9; transform: translateY(-2px); }

        @keyframes crack-spin { 100% { transform: rotate(360deg); } }
        .spin-anim { display: inline-block; animation: crack-spin 1s linear infinite; }
    `);

  // =============================================
  // 2. 패널 구성
  // =============================================
  let loreSlotsHTML = "";
  for (let i = 1; i <= 10; i++) {
    loreSlotsHTML += `
            <details class="lore-details">
                <summary class="lore-summary">
                    <label onclick="event.stopPropagation()"><input type="checkbox" id="lore-active-${i}"> 세계관 규칙 ${i}</label>
                </summary>
                <textarea id="lore-text-${i}" class="expand-input" rows="2" placeholder="이 규칙은 AI가 절대적으로 따릅니다..." style="margin-top: 8px;"></textarea>
            </details>
        `;
  }

  const panel = document.createElement("div");
  panel.id = "crack-ai-panel";
  panel.innerHTML = `
        <div class="panel-header" id="panel-drag-handle">
            <div class="panel-title">✨ AI 집필 설정 (V3.3)</div>
            <div class="panel-close" id="close-panel">✕</div>
        </div>
        <div class="panel-content">

            <div class="setting-group" style="background: var(--bg_elevated_primary); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
                <span class="setting-label" style="color: var(--text_brand);">작업 모드 (서술/묘사)</span>
                <div class="radio-group">
                    <label><input type="radio" name="cfg-mode" value="expand" checked> 🪄 화려하게 부풀리기</label>
                    <label><input type="radio" name="cfg-mode" value="polish"> ✍️ 원본 유지 (고급 다듬기)</label>
                </div>
            </div>

            <div class="ego-slider-box">
                <span class="setting-label" style="margin:0;">🎚️ 대사 개입 및 전개 게이지</span>
                <input type="range" id="cfg-ego" min="1" max="5" value="1" style="width:100%;">
                <div id="ego-desc" class="ego-desc">1단계: 원본 100% 보존 (빈칸: 턴 넘기기)</div>
                <div style="font-size:10px; color:var(--text_secondary); text-align:center; margin-top:4px;">💡 입력창의 내용 유무(대사 vs 빈칸)에 따라 AI의 역할이 스마트하게 바뀝니다.</div>
            </div>

            <div class="info-box">
                <div>
                    <div class="info-title">🔍 현재 감지된 프로필 (채팅방 자동저장)</div>
                    <div id="detected-profile" class="info-text" style="font-weight:800; margin-top:6px;">스캔 대기 중...</div>
                </div>
                <div style="border-top: 1px solid var(--border); padding-top: 10px;">
                    <div class="info-title">📝 PC 추가 설정 (방별 실시간 저장)</div>
                    <textarea id="cfg-pc-note" class="expand-input" style="font-size:13px; height:80px; margin-top:6px; margin-bottom:0;" placeholder="AI 집필에 반영할 PC(플레이어)의 성격, 과거사, 특이사항 등을 적어주세요."></textarea>
                </div>
            </div>

            <div class="setting-group">
                <span class="setting-label">서술 시점</span>
                <div class="radio-group">
                    <label><input type="radio" name="cfg-pov" value="1" checked> 1인칭 (나)</label>
                    <label><input type="radio" name="cfg-pov" value="3"> 3인칭</label>
                    <input type="text" id="cfg-pov-name" class="expand-input" placeholder="이름 (예: )" style="display:none; width:140px; padding:8px; margin:0;">
                </div>
            </div>

            <div class="setting-group">
                <span class="setting-label">문체 스타일</span>
                <select id="cfg-style" class="expand-input">
                    <option value="기본">기본 톤</option>
                    <option value="동화처럼 따뜻하고 몽글몽글한 문체">동화풍 (따뜻/몽글)</option>
                    <option value="라이트노벨처럼 가볍고 톡톡 튀는 문체">라노벨풍 (가벼움/톡톡)</option>
                    <option value="건조하고 간결한 문체">건조/간결</option>
                    <option value="서정적이고 섬세한 문체">서정/섬세</option>
                    <option value="위트 있고 비꼬는 듯한 문체">위트/시니컬</option>
                    <option value="거칠고 냉소적인 하드보일드 문체">하드보일드 (거침/냉소)</option>
                    <option value="정통 무협의 비장하고 묵직한 문체">무협/비장</option>
                    <option value="자조적이고 퇴폐적인 우울한 문체">자조/퇴폐</option>
                </select>
            </div>

            <div class="setting-group">
                <span class="setting-label">분위기 추가 (중복 선택 가능)</span>
                <div class="tone-container">
                    <span class="tone-chip" data-val="로맨스">💕 로맨스</span>
                    <span class="tone-chip" data-val="코믹">😂 코믹</span>
                    <span class="tone-chip" data-val="액션">⚔️ 액션</span>
                    <span class="tone-chip" data-val="스릴러">🔪 스릴러</span>
                    <span class="tone-chip" data-val="공포">👻 공포</span>
                    <span class="tone-chip" data-val="피폐">🌑 피폐</span>
                    <span class="tone-chip" data-val="관능적">💋 관능적</span>
                    <span class="tone-chip" data-val="일상">☕ 일상</span>
                    <span class="tone-chip" data-val="몽환적">✨ 몽환적</span>
                    <span class="tone-chip" data-val="애절함">💧 애절/슬픔</span>
                </div>
            </div>

            <div class="setting-group">
                <span class="setting-label">출력 분량 제한 (목표 문단 수: <span id="len-val" style="color:var(--text_brand);">3</span>문단)</span>
                <input type="range" id="cfg-len" min="1" max="5" value="3" style="width:100%;">
                <div style="font-size:10px; color:var(--text_secondary); text-align:center;">1문단(아주 짧게) ~ 5문단 이상(매우 길게)</div>
            </div>

            <div class="acc-wrapper">
                <div class="acc-header" data-target="acc-lore">🌍 세계관 사전 (최대 10개) <span>▼</span></div>
                <div id="acc-lore" class="acc-content">
                    <div class="slots-container">${loreSlotsHTML}</div>
                </div>
            </div>

            <div class="setting-group">
                <span class="setting-label">💡 커스텀 규칙 (방별 실시간 저장)</span>
                <textarea id="cfg-custom-rule" class="expand-input" rows="3" placeholder="예: 필담은 \` \`로 묶어서 표현할 것."></textarea>
            </div>

            <div class="acc-wrapper">
                <div class="acc-header" data-target="acc-advanced">⚙️ 고급 설정 & API 키 <span>▼</span></div>
                <div id="acc-advanced" class="acc-content">
                    <div class="setting-group">
                        <span class="setting-label" style="margin-top:0;">API 제공자</span>
                        <select id="cfg-api-provider" class="expand-input">
                            <option value="google">Google (기본 API)</option>
                            <option value="firebase">Firebase (Vertex API)</option>
                        </select>
                    </div>
                    <div class="setting-group">
                        <span class="setting-label" id="cfg-key-label">GEMINI API KEY</span>
                        <input type="password" id="cfg-api-key" class="expand-input" placeholder="키를 입력하세요">
                        <textarea id="cfg-firebase-script" class="expand-input" rows="5" placeholder="파이어베이스에서 복사한 코드 전체를 여기에 그대로 붙여넣어 주세요!" style="display:none; font-family: monospace; font-size:12px;"></textarea>
                    </div>
                    <div class="setting-group">
                        <span class="setting-label">AI 모델 선택</span>
                        <select id="cfg-model" class="expand-input">
                            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        </select>
                    </div>
                    <div class="setting-group">
                        <span class="setting-label">🧠 AI 대화 기억력 (현재 <span id="mem-val" style="color:var(--text_brand);">8</span>개)</span>
                        <input type="range" id="cfg-memory" min="1" max="20" value="8" style="width:100%;">
                    </div>
                </div>
            </div>

            <button id="cfg-save-btn" class="btn-save">글로벌 설정 저장</button>
        </div>
    `;
  document.body.appendChild(panel);

  // =============================================
  // 3. 패널 드래그 관리
  // =============================================
  const dragHandle = document.getElementById("panel-drag-handle");
  let isDragging = false,
    startX,
    startY,
    initLeft,
    initTop;

  let savedLeft = GM_getValue("panelLeft", null);
  let savedTop = GM_getValue("panelTop", null);
  if (savedLeft !== null && savedTop !== null) {
    if (
      isNaN(savedLeft) ||
      isNaN(savedTop) ||
      savedLeft < 0 ||
      savedTop < 0 ||
      savedLeft > window.innerWidth ||
      savedTop > window.innerHeight
    ) {
      GM_deleteValue("panelLeft");
      GM_deleteValue("panelTop");
    } else {
      panel.style.left = savedLeft + "px";
      panel.style.top = savedTop + "px";
      panel.style.right = "auto";
    }
  }

  dragHandle.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    initLeft = rect.left;
    initTop = rect.top;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    e.preventDefault();
    let newLeft = Math.max(
      0,
      Math.min(
        initLeft + (e.clientX - startX),
        window.innerWidth - panel.offsetWidth,
      ),
    );
    let newTop = Math.max(
      0,
      Math.min(
        initTop + (e.clientY - startY),
        window.innerHeight - panel.offsetHeight,
      ),
    );
    panel.style.left = newLeft + "px";
    panel.style.top = newTop + "px";
    panel.style.right = "auto";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      GM_setValue("panelLeft", parseInt(panel.style.left));
      GM_setValue("panelTop", parseInt(panel.style.top));
    }
  });

  // =============================================
  // 4. 백그라운드 스캐너
  // =============================================
  function backgroundScanner() {
    const room = getChatRoomId();
    const currentBadge = Array.from(document.querySelectorAll("p")).find(
      (p) => p.textContent.trim() === "현재",
    );
    if (currentBadge) {
      const container =
        currentBadge.closest('div[cursor="pointer"]') ||
        currentBadge.parentElement?.parentElement?.parentElement;
      if (container) {
        const nameEl = container.querySelector('p[color="text_primary"]');
        const profileEl = container.querySelector('p[color="text_secondary"]');
        if (nameEl)
          GM_setValue("scannedCharName_" + room, nameEl.textContent.trim());
        if (profileEl)
          GM_setValue(
            "scannedCharProfile_" + room,
            profileEl.textContent.trim(),
          );
      }
    }
  }

  function updateContextDisplay() {
    const room = getChatRoomId();
    const name = GM_getValue("scannedCharName_" + room, "");
    const prof = GM_getValue("scannedCharProfile_" + room, "");
    document.getElementById("detected-profile").innerText = name
      ? `[${name}]\n${prof}`
      : "❌ 프로필 선택창을 한 번 열어주세요.";
  }

  document.getElementById("cfg-pc-note").addEventListener("input", (e) => {
    const room = getChatRoomId();
    GM_setValue("cfgPcNote_" + room, e.target.value);
  });
  document.getElementById("cfg-custom-rule").addEventListener("input", (e) => {
    const room = getChatRoomId();
    GM_setValue("cfgCustomRule_" + room, e.target.value);
  });

  // =============================================
  // 5. 설정 이벤트 & UI 토글
  // =============================================
  const egoSlider = document.getElementById("cfg-ego");
  const egoDesc = document.getElementById("ego-desc");
  const egoTexts = [
    "1단계: 원본 100% 보존 (빈칸: 턴 넘기기)",
    "2단계: 어투 완벽 동기화 (빈칸: 자연스러운 호응)",
    "3단계: 추임새/생동감 부여 (빈칸: 능동적 진도 빼기)",
    "4단계: 감정/분량 적극 확장 (빈칸: 적극적 몰입과 리드)",
    "5단계: 의도 기반 완전 재창조 (빈칸: 완벽한 씬 장악)",
  ];

  const toggleProviderUI = () => {
    const provider = document.getElementById("cfg-api-provider").value;
    if (provider === "firebase") {
      document.getElementById("cfg-api-key").style.display = "none";
      document.getElementById("cfg-firebase-script").style.display = "block";
      document.getElementById("cfg-key-label").innerText =
        "Firebase Config 복붙창:";
    } else {
      document.getElementById("cfg-api-key").style.display = "block";
      document.getElementById("cfg-firebase-script").style.display = "none";
      document.getElementById("cfg-key-label").innerText = "GEMINI API KEY";
    }
  };
  document
    .getElementById("cfg-api-provider")
    .addEventListener("change", toggleProviderUI);

  const loadCfg = () => {
    const room = getChatRoomId();

    document.getElementById("cfg-api-provider").value = GM_getValue(
      "apiProvider",
      "google",
    );
    document.getElementById("cfg-api-key").value = GM_getValue("apiKey", "");
    document.getElementById("cfg-firebase-script").value = GM_getValue(
      "firebaseScript",
      "",
    );
    toggleProviderUI();

    document.getElementById("cfg-model").value = GM_getValue(
      "cfgModel",
      "gemini-3.1-pro-preview",
    );
    document.getElementById("cfg-style").value = GM_getValue(
      "cfgStyle",
      "기본",
    );

    document.getElementById("cfg-pc-note").value = GM_getValue(
      "cfgPcNote_" + room,
      "",
    );
    document.getElementById("cfg-custom-rule").value = GM_getValue(
      "cfgCustomRule_" + room,
      "",
    );

    const lenVal = GM_getValue("cfgLen", 3);
    document.getElementById("cfg-len").value = lenVal;
    document.getElementById("len-val").innerText = lenVal;

    const savedMode = GM_getValue("cfgMode", "expand");
    document.querySelector(
      `input[name="cfg-mode"][value="${savedMode}"]`,
    ).checked = true;

    const pov = GM_getValue("cfgPov", "1");
    document.querySelector(`input[name="cfg-pov"][value="${pov}"]`).checked =
      true;
    document.getElementById("cfg-pov-name").value = GM_getValue(
      "cfgPovName",
      "",
    );
    document.getElementById("cfg-pov-name").style.display =
      pov === "3" ? "block" : "none";

    egoSlider.value = GM_getValue("cfgEgo", 1);
    egoDesc.innerText = egoTexts[egoSlider.value - 1];

    const savedTones = JSON.parse(GM_getValue("cfgTones", "[]"));
    document.querySelectorAll(".tone-chip").forEach((chip) => {
      chip.classList.toggle("active", savedTones.includes(chip.dataset.val));
    });

    for (let i = 1; i <= 10; i++) {
      document.getElementById(`lore-active-${i}`).checked = GM_getValue(
        `loreActive${i}`,
        false,
      );
      document.getElementById(`lore-text-${i}`).value = GM_getValue(
        `loreText${i}`,
        "",
      );
    }

    const mem = GM_getValue("cfgMemory", 8);
    document.getElementById("cfg-memory").value = mem;
    document.getElementById("mem-val").innerText = mem;

    updateContextDisplay();
  };

  const saveCfg = () => {
    const room = getChatRoomId();

    GM_setValue(
      "apiProvider",
      document.getElementById("cfg-api-provider").value,
    );
    GM_setValue("apiKey", document.getElementById("cfg-api-key").value.trim());
    GM_setValue(
      "firebaseScript",
      document.getElementById("cfg-firebase-script").value.trim(),
    );
    GM_setValue("cfgModel", document.getElementById("cfg-model").value);
    GM_setValue("cfgStyle", document.getElementById("cfg-style").value);

    GM_setValue(
      "cfgPcNote_" + room,
      document.getElementById("cfg-pc-note").value.trim(),
    );
    GM_setValue(
      "cfgCustomRule_" + room,
      document.getElementById("cfg-custom-rule").value.trim(),
    );
    GM_setValue("cfgLen", document.getElementById("cfg-len").value);

    const mode = document.querySelector('input[name="cfg-mode"]:checked').value;
    GM_setValue("cfgMode", mode);

    const pov = document.querySelector('input[name="cfg-pov"]:checked').value;
    GM_setValue("cfgPov", pov);
    GM_setValue(
      "cfgPovName",
      document.getElementById("cfg-pov-name").value.trim(),
    );

    GM_setValue("cfgEgo", egoSlider.value);

    const activeTones = Array.from(
      document.querySelectorAll(".tone-chip.active"),
    ).map((c) => c.dataset.val);
    GM_setValue("cfgTones", JSON.stringify(activeTones));

    for (let i = 1; i <= 10; i++) {
      GM_setValue(
        `loreActive${i}`,
        document.getElementById(`lore-active-${i}`).checked,
      );
      GM_setValue(
        `loreText${i}`,
        document.getElementById(`lore-text-${i}`).value.trim(),
      );
    }

    GM_setValue("cfgMemory", document.getElementById("cfg-memory").value);
    alert("글로벌 설정이 저장되었습니다!");
  };

  document.getElementById("close-panel").onclick = () =>
    (panel.style.display = "none");
  document.getElementById("cfg-save-btn").onclick = saveCfg;

  document.querySelectorAll(".tone-chip").forEach((chip) => {
    chip.onclick = () => chip.classList.toggle("active");
  });

  document.getElementsByName("cfg-pov").forEach((r) => {
    r.addEventListener("change", () => {
      document.getElementById("cfg-pov-name").style.display =
        r.value === "3" ? "block" : "none";
    });
  });

  document.getElementById("cfg-memory").addEventListener("input", (e) => {
    document.getElementById("mem-val").innerText = e.target.value;
  });
  document.getElementById("cfg-len").addEventListener("input", (e) => {
    document.getElementById("len-val").innerText = e.target.value;
  });
  egoSlider.addEventListener("input", () => {
    egoDesc.innerText = egoTexts[egoSlider.value - 1];
  });

  document.querySelectorAll(".acc-header").forEach((header) => {
    header.addEventListener("click", () => {
      const target = document.getElementById(
        header.getAttribute("data-target"),
      );
      const isOpen = target.classList.contains("open");
      target.classList.toggle("open");
      header.innerHTML = header.innerHTML.replace(
        isOpen ? "▲" : "▼",
        isOpen ? "▼" : "▲",
      );
    });
  });

  // =============================================
  // 6. Gemini API / Firebase 통신
  // =============================================
  async function fetchChatHistory() {
    const path = location.pathname.match(
      /\/stories\/([^/]+)\/episodes\/([^/]+)/,
    );
    if (!path) return "(맥락 없음)";
    try {
      const token = document.cookie
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("access_token="))
        ?.slice(13);
      const limit = GM_getValue("cfgMemory", 8);
      const res = await fetch(
        `${API_BASE}/v3/chats/${path[2]}/messages?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      const json = await res.json();
      const msgs = (json.data ?? json).messages ?? [];
      return msgs
        .reverse()
        .map((m) => `[${m.role === "assistant" ? "상대" : "나"}]: ${m.content}`)
        .join("\n\n");
    } catch (e) {
      return "(맥락 로드 실패)";
    }
  }

  function callGemini(baseText) {
    return new Promise(async (resolve, reject) => {
      const provider = GM_getValue("apiProvider", "google");
      const room = getChatRoomId();
      const history = await fetchChatHistory();
      const model = GM_getValue("cfgModel", "gemini-3.1-pro-preview");
      const name = GM_getValue("scannedCharName_" + room, "");
      const prof = GM_getValue("scannedCharProfile_" + room, "");

      const pcNote = GM_getValue("cfgPcNote_" + room, "");
      const customRule = GM_getValue("cfgCustomRule_" + room, "");

      const mode = GM_getValue("cfgMode", "expand");
      const pov = GM_getValue("cfgPov", "1");
      const povName = GM_getValue("cfgPovName", "");
      const style = GM_getValue("cfgStyle", "기본");
      const len = GM_getValue("cfgLen", 3);
      const egoLevel = GM_getValue("cfgEgo", 1);
      const tones = JSON.parse(GM_getValue("cfgTones", "[]")).join(", ");

      const activeLores = [];
      for (let i = 1; i <= 10; i++) {
        if (
          GM_getValue(`loreActive${i}`, false) &&
          GM_getValue(`loreText${i}`, "")
        ) {
          activeLores.push(GM_getValue(`loreText${i}`, ""));
        }
      }

      let povInstruct =
        pov === "1"
          ? "1인칭('나') 시점으로 서술"
          : `${povName || name || "캐릭터"} 중심의 3인칭 시점으로 서술`;

      let lenInstruction = `전체 길이를 반드시 ${len}문단 내외로 배분하여 작성하십시오.`;
      if (len == 1)
        lenInstruction =
          "전체 길이를 반드시 1문단 이내로 제한하여 아주 짧고 속도감 있게 작성하십시오.";
      else if (len == 5)
        lenInstruction =
          "전체 길이를 최소 5~6문단 이상으로 아주 길고 볼륨감 있게 꽉꽉 채워서 작성하십시오. 분량을 아끼지 마십시오.";

      let sysPrompt = `당신은 초월적인 롤플레잉 작가입니다.\n1. 시점: ${povInstruct}.\n2. 감지된 상대 정보: 이름 [${name}], 설정 [${prof}].\n`;
      if (pcNote) sysPrompt += `3. PC(플레이어) 추가 설정: ${pcNote}\n`;
      if (customRule)
        sysPrompt += `4. 커스텀 규칙: ${customRule} (이 규칙을 최우선으로 반영하세요!)\n`;
      if (activeLores.length > 0)
        sysPrompt += `5. 절대 세계관: \n${activeLores.join("\n")}\n`;

      sysPrompt += `6. 타 캐릭터 조종 방지: 상대방(NPC)의 대사를 임의로 지어내거나 깊은 내면을 서술하지 마십시오. 상대방의 행동은 사용자의 시야에 보이는 객관적이고 짧은 리액션 정도로 제한하십시오.\n`;

      if (mode === "polish") {
        sysPrompt += `7. 작업 모드 (다듬기): 대충 적힌 뼈대 문장의 의도를 정확히 파악하여, 문맥을 매끄럽게 연결하고 선택한 문체에 맞춰 어휘를 고급스럽게 윤문하십시오.\n`;
      } else {
        sysPrompt += `7. 작업 모드 (부풀리기): 전문 웹소설 작가의 화려하고 몰입감 있는 문체로 상황을 풍성하게 묘사하십시오. 피부로 느끼는 공기의 온도, 시선의 떨림 등 오감 묘사와 겉으로 드러나는 행동 이면에 깔린 감정선을 서술하여 씬의 밀도를 극대화하십시오.\n`;
      }
      sysPrompt += `8. 출력 분량 통제: ${lenInstruction}\n`;

      let egoInstruction = "9. 대사 개입 및 상황 전개 지시: \n";
      if (baseText) {
        if (egoLevel == 1)
          egoInstruction +=
            "- 1단계: 유저가 입력한 대사의 의미, 길이, 단어를 완벽하게 유지하며 오직 맞춤법과 띄어쓰기만 교정하십시오.\n";
        else if (egoLevel == 2)
          egoInstruction +=
            "- 2단계: 대사의 본래 의미를 훼손하지 않는 선에서, PC의 성격과 설정에 가장 자연스럽게 어울리는 특유의 말투(어투)로만 살짝 다듬으십시오.\n";
        else if (egoLevel == 3)
          egoInstruction +=
            "- 3단계: 말투를 동기화하는 것에 더해, 대사 사이사이에 감정이 묻어나는 말줄임표(...), 한숨, 미세한 떨림이나 자연스러운 추임새를 추가하여 생동감을 불어넣으십시오.\n";
        else if (egoLevel == 4)
          egoInstruction +=
            "- 4단계: 유저가 던진 뼈대 대사의 핵심 의도를 파악하고, 그에 맞는 감정을 깊게 실어 할 말을 더 풍성하고 설득력 있게 확장하십시오.\n";
        else if (egoLevel == 5)
          egoInstruction +=
            "- 5단계: 유저 대사의 뼈대 의도만 남기고 문장을 해체한 뒤, 현재 상황에서 PC가 보여줄 수 있는 가장 극적이고 몰입감 넘치는 소설 속 명대사로 100% 새롭게 지어내십시오.\n";
      } else {
        if (egoLevel == 1)
          egoInstruction +=
            "- 1단계: 대사와 행동을 극도로 아끼고 조용히 관망하십시오. 절대 상대방(NPC)의 대사나 행동을 대신 작성하지 말고 턴을 넘기십시오.\n";
        else if (egoLevel == 2)
          egoInstruction +=
            "- 2단계: 상대방의 직전 턴에 자연스럽게 호응하십시오. 상황을 크게 바꾸지 않는 선에서 부드럽게 대화의 흐름(핑퐁)만 이어가십시오.\n";
        else if (egoLevel == 3)
          egoInstruction +=
            "- 3단계: 현재의 대화 맥락과 PC의 설정을 바탕으로, 상황을 유동적이고 매끄럽게 다음 단계로 진전시키십시오. 엉뚱한 주제를 꺼내지 말고 현재 상황 안에서 주도적으로 극을 이끌어가십시오.\n";
        else if (egoLevel == 4)
          egoInstruction +=
            "- 4단계: PC의 감정과 성격을 적극적으로 드러내어 현재 씬(Scene)의 분위기를 확실하게 리드하십시오. 상황이 정체되지 않도록 능동적이고 확신에 찬 행동으로 스토리를 전진시키십시오.\n";
        else if (egoLevel == 5)
          egoInstruction +=
            "- 5단계: 뜬금없는 사건을 터뜨리지 마십시오. 단, 현재 마주한 상황 안에서 PC가 보여줄 수 있는 가장 결단력 있고 압도적인 언행을 창작하여, 타협 없이 씬의 주도권을 100% 쥐고 상황을 강력하게 통제하십시오.\n";
      }
      sysPrompt += egoInstruction;

      sysPrompt +=
        "10. 유저 입력 양식 주의사항: 사용자는 입력 시 대사는 따옴표 없이 일반 텍스트로 적고, 행동이나 묘사, 속마음은 * * 기호로 감싸서 구분합니다. 이를 바탕으로 문맥을 정확히 파악하십시오.\n";
      sysPrompt += `11. 요구 분위기: [${tones}], 문체: [${style}].\n`;
      sysPrompt += `12. 최종 출력 양식: 행동은 * * 로, 대사는 " " 로 감싸고 둘 사이엔 줄바꿈을 넣으세요. 오직 롤플레잉 본문만 출력하세요.\n`;

      sysPrompt += `\n[🔥 초월 작가 절대 원칙 - 퀄리티 극대화]\n`;
      sysPrompt += `13. 오글거리는 요약/마무리 금지: 내레이터처럼 상황을 요약하거나 수사학적 질문("과연 어떻게 될까?")으로 턴을 끝내지 마십시오. 철저히 현재 진행형의 묘사, 대사, 행동으로만 씬(Scene)을 끝맺으십시오.\n`;
      sysPrompt += `14. 일차원적 감정 서술 금지 (Show, Don't Tell): '슬펐다, 화났다, 당황했다' 같은 1차원적 단어 사용을 엄격히 금지합니다. 시선의 방향, 호흡의 변화, 손끝의 미세한 떨림 등 간접적인 행동과 생생한 오감 묘사로 텐션을 연출하십시오.\n`;
      sysPrompt += `15. 대화의 핑퐁 최적화: 분량을 채우기 위해 불필요한 과거 회상이나 장황한 독백을 남발하지 마십시오. 상대방이 눈앞에 있다면, 상대의 미세한 반응을 살피고 즉각적으로 반응하는 실시간 상호작용에 집중하십시오.\n`;

      let userContent = "";
      if (baseText) {
        userContent = `[이전 맥락]\n${history}\n\n[입력된 뼈대 문장]\n${baseText}\n\n위 내용을 뼈대로 지시사항에 맞춰 집필해.`;
      } else {
        userContent = `[이전 맥락]\n${history}\n\n[자동 이어쓰기 요청]\n사용자의 입력이 없습니다. 위 대화 맥락을 완벽히 읽고, 지시사항(특히 '대사 개입 및 상황 전개 지시' 단계)에 맞춰 당신이 직접 다음 턴(사용자 캐릭터의 반응)을 상상하여 100% 창작해 주십시오.`;
      }

      if (provider === "firebase") {
        const configRaw = GM_getValue("firebaseScript", "");
        if (!configRaw)
          return reject(
            new Error("설정에서 Firebase 복사본을 먼저 입력해주세요!"),
          );

        let configObj;
        let fbVersion = "12.12.0";

        try {
          const versionMatch = configRaw.match(
            /firebasejs\/([0-9.]+)\/firebase-app\.js/,
          );
          if (versionMatch && versionMatch[1]) fbVersion = versionMatch[1];

          const match = configRaw.match(
            /const\s+firebaseConfig\s*=\s*({[\s\S]*?});/,
          );
          if (match && match[1]) {
            configObj = new Function("return " + match[1])();
          } else {
            const fallbackMatch = configRaw.match(
              /({[\s\S]*?apiKey[\s\S]*?appId[\s\S]*?})/,
            );
            if (fallbackMatch && fallbackMatch[1])
              configObj = new Function("return " + fallbackMatch[1])();
            else throw new Error("형식 오류");
          }
        } catch (e) {
          return reject(
            new Error(
              "Firebase 코드를 해독하지 못했습니다. 파이어베이스 홈페이지에서 준 <script> 태그 포함된 코드를 그대로 넣어주세요.",
            ),
          );
        }

        try {
          const appUrl = `https://www.gstatic.com/firebasejs/${fbVersion}/firebase-app.js`;
          const majorVersion = parseInt(fbVersion.split(".")[0]);
          const aiUrl =
            majorVersion >= 12
              ? `https://www.gstatic.com/firebasejs/${fbVersion}/firebase-ai.js`
              : `https://www.gstatic.com/firebasejs/${fbVersion}/firebase-vertexai.js`;

          const { initializeApp, getApps, getApp } = await import(appUrl);
          let ai, generativeModel;

          if (majorVersion >= 12) {
            const {
              HarmBlockThreshold,
              HarmCategory,
              getAI,
              getGenerativeModel,
              VertexAIBackend,
            } = await import(aiUrl);
            const apps = getApps();
            const app = apps.length === 0 ? initializeApp(configObj) : getApp();
            ai = getAI(app, { backend: new VertexAIBackend("global") });

            const safetySettings = [
              {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.OFF,
              },
              {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.OFF,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.OFF,
              },
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.OFF,
              },
            ];

            generativeModel = getGenerativeModel(ai, {
              model: model,
              safetySettings,
              systemInstruction: { parts: [{ text: sysPrompt }] },
              generationConfig: { temperature: 0.8 },
            });
          } else {
            const {
              HarmBlockThreshold,
              HarmCategory,
              getVertexAI,
              getGenerativeModel,
            } = await import(aiUrl);
            const apps = getApps();
            const app = apps.length === 0 ? initializeApp(configObj) : getApp();
            ai = getVertexAI(app);

            const safetySettings = [
              {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.OFF,
              },
              {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.OFF,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.OFF,
              },
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.OFF,
              },
            ];

            generativeModel = getGenerativeModel(ai, {
              model: model,
              safetySettings,
              systemInstruction: { parts: [{ text: sysPrompt }] },
              generationConfig: { temperature: 0.8 },
            });
          }

          const result = await generativeModel.generateContent(userContent);
          let rawResult = result.response.text().trim();
          rawResult = rawResult
            .replace(/^```[^\n]*\n([\s\S]*?)\n```\s*$/m, "$1")
            .trim();
          resolve(rawResult);
        } catch (e) {
          reject(new Error("Firebase Vertex 통신 실패: " + e.message));
        }
      } else {
        // 기존 Google API (Gemini Direct)
        const key = GM_getValue("apiKey", "");
        if (!key)
          return reject(new Error("설정에서 API 키를 먼저 입력해주세요!"));

        GM_xmlhttpRequest({
          method: "POST",
          url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          headers: { "Content-Type": "application/json" },
          data: JSON.stringify({
            system_instruction: { parts: [{ text: sysPrompt }] },
            contents: [{ parts: [{ text: userContent }] }],
            generationConfig: { temperature: 0.8 },
          }),
          onload: (res) => {
            try {
              const data = JSON.parse(res.responseText);
              if (data.error) reject(new Error(data.error.message));
              else {
                let raw = data.candidates[0].content.parts[0].text.trim();
                raw = raw
                  .replace(/^```[^\n]*\n([\s\S]*?)\n```\s*$/m, "$1")
                  .trim();
                resolve(raw);
              }
            } catch (e) {
              reject(new Error("응답 분석 실패"));
            }
          },
          onerror: () => reject(new Error("네트워크 오류")),
        });
      }
    });
  }

  // =============================================
  // 7. UI 자동 주입 (설정 버튼 원래 자리 복구 + 새 채팅창 호환)
  // =============================================
  let currentRoomId = "";

  function injectUI() {
    const newRoomId = getChatRoomId();
    if (currentRoomId !== newRoomId) {
      currentRoomId = newRoomId;
      loadCfg();
    }

    // 1. [원상 복구] 설정 버튼(⚙️) 주입: 기존처럼 'model-icon' 옆에 딱 붙임
    const modelBtn = Array.from(document.querySelectorAll("button")).find(
      (btn) => {
        return btn.querySelector('img[src*="model-icon"]');
      },
    );

    if (modelBtn && !document.getElementById("crack-pure-settings-btn")) {
      const sBtn = document.createElement("button");
      sBtn.id = "crack-pure-settings-btn";
      sBtn.className = "crack-pure-settings";
      // 🌟 반응형 처리를 위해 글씨 부분을 span으로 감싸기
      sBtn.innerHTML = `⚙️ <span class="setting-btn-text">AI 설정</span>`;
      sBtn.onclick = (e) => {
        e.preventDefault();
        updateContextDisplay();
        panel.style.display = panel.style.display === "block" ? "none" : "flex";
      };
      modelBtn.parentNode.insertBefore(sBtn, modelBtn);
    }

    // 2. [원상 복구] 마법 버튼(✨) 주입을 위한 전송 버튼 찾기
    const sendBtnIcon = document.querySelector('path[d*="M18.77 11.13"]');
    const sendBtn = sendBtnIcon ? sendBtnIcon.closest("button") : null;

    if (sendBtn && !document.getElementById("crack-pure-magic-btn")) {
      const group = document.createElement("div");
      group.className = "crack-right-group";
      sendBtn.parentNode.insertBefore(group, sendBtn);

      const hWidget = document.createElement("div");
      hWidget.id = "crack-history-widget";
      hWidget.className = "crack-history-widget";
      hWidget.innerHTML = `
                <span class="crack-history-btn" id="history-prev">◀</span>
                <span id="history-text">1/1</span>
                <span class="crack-history-btn" id="history-next">▶</span>
            `;
      group.appendChild(hWidget);

      const gBtn = document.createElement("button");
      gBtn.id = "crack-pure-magic-btn";
      gBtn.className = "crack-pure-magic";
      gBtn.innerHTML = `<span id="magic-icon" style="font-size: 14px;">✨</span>`;

      // 3. [최신 패치] 업데이트된 채팅 에디터에 텍스트 넣기
      const updateChatInputFromHistory = () => {
        const chatInput = document.querySelector(
          '.__chat_input_textarea, div[contenteditable="true"], textarea',
        );
        if (!chatInput || generatedHistory.length === 0) return;

        const textToInsert = generatedHistory[historyIndex];

        if (chatInput.tagName === "TEXTAREA") {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            "value",
          ).set;
          setter.call(chatInput, textToInsert);
          chatInput.style.height = "auto";
          chatInput.style.height = chatInput.scrollHeight + "px";
        } else {
          // 새로운 div 에디터 방식
          chatInput.innerHTML = `<p>${textToInsert}</p>`;
        }

        chatInput.dispatchEvent(new Event("input", { bubbles: true }));
        chatInput.focus();

        document.getElementById("history-text").innerText =
          `${historyIndex + 1}/${generatedHistory.length}`;
      };

      hWidget.querySelector("#history-prev").onclick = (e) => {
        e.preventDefault();
        if (historyIndex > 0) {
          historyIndex--;
          updateChatInputFromHistory();
        }
      };
      hWidget.querySelector("#history-next").onclick = (e) => {
        e.preventDefault();
        if (historyIndex < generatedHistory.length - 1) {
          historyIndex++;
          updateChatInputFromHistory();
        }
      };

      gBtn.onclick = async (e) => {
        e.preventDefault();
        // 4. [최신 패치] 업데이트된 에디터에서 텍스트 읽어오기
        const chatInput = document.querySelector(
          '.__chat_input_textarea, div[contenteditable="true"], textarea',
        );
        if (!chatInput) return alert("채팅 입력창을 찾을 수 없습니다.");

        const baseText =
          chatInput.tagName === "TEXTAREA"
            ? chatInput.value.trim()
            : chatInput.innerText.trim();

        const icon = document.getElementById("magic-icon");
        icon.innerHTML = "⏳";
        icon.classList.add("spin-anim");

        try {
          const result = await callGemini(baseText);

          if (generatedHistory.length === 0) {
            generatedHistory.push(baseText);
          }
          generatedHistory.push(result);
          historyIndex = generatedHistory.length - 1;

          updateChatInputFromHistory();

          if (generatedHistory.length > 1) {
            hWidget.style.display = "flex";
          }
        } catch (err) {
          alert(err.message);
        } finally {
          icon.innerHTML = "✨";
          icon.classList.remove("spin-anim");
        }
      };

      group.appendChild(gBtn);
      group.appendChild(sendBtn);

      sendBtn.addEventListener("click", () => {
        generatedHistory = [];
        historyIndex = -1;
        hWidget.style.display = "none";
      });
    }

    // 5. [최신 패치] 엔터키 감지도 새로운 입력창 호환으로 변경
    const chatInput = document.querySelector(
      '.__chat_input_textarea, div[contenteditable="true"], textarea',
    );
    if (chatInput && !chatInput.dataset.historyHooked) {
      chatInput.dataset.historyHooked = "true";
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          generatedHistory = [];
          historyIndex = -1;
          const w = document.getElementById("crack-history-widget");
          if (w) w.style.display = "none";
        }
      });
    }
  }

  setInterval(() => {
    backgroundScanner();
    injectUI();
  }, 1000);
})();

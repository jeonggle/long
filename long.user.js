// ==UserScript==
// @name         크랙 AI 문장 부풀리기
// @namespace    http://tampermonkey.net/
// @version      17.0
// @description  다국어 번역, 디렉터 모드, 다중 프로필 등 유지
// @match        https://crack.wrtn.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      generativelanguage.googleapis.com
// @connect      firebasevertexai.googleapis.com
// ==/UserScript==

(function () {
    'use strict';

    const API_BASE = 'https://crack-api.wrtn.ai/crack-gen';

    // =============================================
    //  지원 언어 목록 (10개국)
    // =============================================
    const SUPPORTED_LANGS =[
        { v: 'en', t: '영어 (English)' },
        { v: 'ja', t: '일본어 (Japanese)' },
        { v: 'zh', t: '중국어 (Chinese)' },
        { v: 'es', t: '스페인어 (Spanish)' },
        { v: 'fr', t: '프랑스어 (French)' },
        { v: 'de', t: '독일어 (German)' },
        { v: 'it', t: '이탈리아어 (Italian)' },
        { v: 'ru', t: '러시아어 (Russian)' },
        { v: 'pt', t: '포르투갈어 (Portuguese)' },
        { v: 'ar', t: '아랍어 (Arabic)' }
    ];

    // =============================================
    //  스타일 (다크모드 완벽 대응)
    // =============================================
    GM_addStyle(`
        #expand-toggle-btn {
            position: fixed; bottom: 80px; right: 20px; z-index: 999999;
            background-color: #2D2C2A; color: white; border: none; border-radius: 50%;
            width: 48px; height: 48px; font-size: 20px; cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
            touch-action: none;
        }
        #expand-toggle-btn.dragging { transition: none !important; opacity: 0.8; transform: scale(1.1); }

        #expand-panel {
            position: fixed; bottom: 140px; right: 20px; z-index: 999999;
            background-color: #F7F7F5 !important; border: 1px solid #C7C5BD; border-radius: 8px;
            padding: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            display: none; width: 340px; max-width: 85vw; max-height: 75vh; overflow-y: auto;
            font-family: sans-serif;
            color: #1A1918 !important;
            opacity: var(--base-opacity, 1);
            transition: opacity 0.3s ease;
        }
        #expand-panel.auto-blur:not(:hover):not(:focus-within) { opacity: 0.4 !important; }
        #expand-panel::-webkit-scrollbar { width: 6px; }
        #expand-panel::-webkit-scrollbar-thumb { background-color: #C7C5BD; border-radius: 4px; }

        #expand-panel h4 { margin: 0 0 12px 0; color: #1A1918 !important; font-size: 15px; display:flex; justify-content:space-between; }
        .expand-label { font-size: 12px; color: #61605A !important; margin: 10px 0 4px 0; display: block; font-weight: bold; }
        
        .expand-input {
            width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 4px;
            background-color: #FFFFFF !important; color: #1A1918 !important;
            border: 1px solid #C7C5BD !important; border-radius: 4px; font-size: 13px; resize: vertical;
        }
        .expand-input::placeholder { color: #A0A0A0 !important; }
        
        .radio-group { display: flex; gap: 10px; margin-bottom: 8px; font-size: 13px; color: #1A1918 !important; }
        .radio-group label { cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: bold; }
        
        .tone-container, .macro-container, .trpg-container, .sense-container { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
        
        .tone-chip, .sense-chip { padding: 4px 10px; border: 1px solid #C7C5BD; border-radius: 12px; font-size: 11px; cursor: pointer; color: #61605A !important; background: #fff !important; transition: 0.2s; user-select: none; }
        .tone-chip.active, .sense-chip.active { background-color: #6A3DE8 !important; color: white !important; border-color: #6A3DE8 !important; font-weight: bold; }

        .macro-chip { padding: 2px 8px; border: 1px solid #A8D5B5; border-radius: 4px; font-size: 11px; cursor: grab; color: #1A7A3A !important; background: #F0FAF3 !important; user-select: none; }
        .macro-chip:hover { background: #D0EEDC !important; }
        .macro-chip:active { cursor: grabbing; }

        .trpg-chip { padding: 4px 8px; border: 1px solid #C7C5BD; border-radius: 4px; font-size: 11px; cursor: pointer; color: #61605A !important; background: #E5E5E1 !important; user-select: none; font-weight: bold; }
        .trpg-chip.active { background-color: #FF4432 !important; color: white !important; border-color: #FF4432 !important; }

        #history-controls { display: none; font-size: 11px; font-weight: normal; color: #1A1918 !important; }
        #history-controls button { background: none; border: 1px solid #C7C5BD; border-radius: 4px; cursor: pointer; padding: 2px 6px; color:#1A1918 !important; }
        #history-controls button:hover { background: #E5E5E1; }

        .slots-container { max-height: 200px; overflow-y: auto; border: 1px solid #C7C5BD; border-radius: 4px; padding: 6px; background: #F0F0EE !important; margin-bottom: 4px; }
        .slots-container::-webkit-scrollbar { width: 6px; }
        .slots-container::-webkit-scrollbar-thumb { background-color: #C7C5BD; border-radius: 4px; }
        .slot-item { border: 1px solid #E5E5E1; background: #fff !important; border-radius: 4px; padding: 6px; margin-bottom: 6px; }
        .slot-item:last-child { margin-bottom: 0; }
        .slot-item label { font-size: 12px; font-weight: bold; color: #4A4A8A !important; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; cursor: pointer; }
        
        .sym-inputs { display: flex; gap: 4px; margin-bottom: 4px; }
        .sym-inputs input { flex: 1; padding: 4px; border: 1px solid #C7C5BD; border-radius: 4px; font-size: 12px; text-align: center; }

        .flex-btns { display: flex; gap: 6px; margin-top: 8px; }
        .flex-btns button { flex: 1; padding: 10px; font-size: 12px; border: none; border-radius: 4px; color: white !important; cursor: pointer; font-weight: bold; }
        .btn-generate { background-color: #6A3DE8; flex: 3 !important; }
        .btn-generate:hover { background-color: #5228CC; }
        .btn-reroll { background-color: #FF8C00; flex: 1 !important; font-size: 16px !important; padding: 0 !important; }
        .btn-reroll:hover { background-color: #E07B00; }
        .btn-apply { background-color: #FF4432; width: 100%; margin-top:8px; padding: 10px; font-size: 12px; border: none; border-radius: 4px; color: white !important; font-weight: bold; cursor: pointer;}
        .btn-apply:hover { background-color: #e03c2a; }

        #expand-status { margin-top: 8px; font-size: 12px; color: #61605A !important; text-align: center; min-height: 18px; word-break: break-word;}
        .toggle-settings { font-size: 12px; color: #1A1918 !important; text-align: center; cursor: pointer; background: #E5E5E1; padding: 6px; border-radius: 4px; margin-top: 15px; font-weight: bold; }
        #expand-settings-wrapper { display: none; margin-top: 10px; padding: 10px; background: #fff !important; border: 1px solid #E5E5E1; border-radius: 4px;}

        /* 번역 UI 컨테이너 */
        .trans-container { background:#e8f0fe !important; padding:8px; border-radius:4px; margin-top:6px; border:1px solid #c4b8f5; }
        .trans-container select, .trans-container button { font-size:11px; padding:4px; color:#1A1918 !important; background:#fff !important; border:1px solid #C7C5BD; border-radius:4px; }
        .trans-container button { cursor:pointer; font-weight:bold; }
        .trans-container .btn-trans-drag { background:#6A3DE8 !important; color:white !important; border:none; }
        .trans-container .btn-trans-dia { background:#2D2C2A !important; color:white !important; border:none; }

        .acc-header {
            font-size: 12px; font-weight: bold; color: #1A1918 !important; background: #F0F0EE !important; 
            padding: 8px; border-radius: 4px; cursor: pointer; margin-top: 8px; user-select: none;
            display: flex; justify-content: space-between; align-items: center; border: 1px solid #E5E5E1;
        }
        .acc-header:hover { background: #E5E5E1 !important; }
        .acc-content { display: none; padding: 8px; border: 1px solid #E5E5E1; border-top: none; border-bottom-left-radius: 4px; border-bottom-right-radius: 4px; margin-bottom: 4px; }
        .acc-content.open { display: block; }
        .acc-content.highlight { background-color: #f9f5ff !important; border-color: #c4b8f5; }
    `);

    // =============================================
    //  DOM 생성
    // =============================================
    let charSlotsHTML = ''; let loreSlotsHTML = '';
    for (let i = 1; i <= 10; i++) {
        charSlotsHTML += `<div class="slot-item"><label><input type="checkbox" id="char-active-${i}"> 프로필 ${i}</label><textarea id="char-text-${i}" class="expand-input" rows="1" placeholder="외형, 성격 등..."></textarea></div>`;
        loreSlotsHTML += `<div class="slot-item"><label><input type="checkbox" id="lore-active-${i}"> 세계관 규칙 ${i}</label><textarea id="lore-text-${i}" class="expand-input" rows="1" placeholder="절대 규칙 설정..."></textarea></div>`;
    }

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'expand-toggle-btn'; toggleBtn.innerHTML = '📝';
    document.body.appendChild(toggleBtn);

    const panel = document.createElement('div');
    panel.id = 'expand-panel';
    panel.innerHTML = `
        <h4>✨ RP 초월 작가 <span style="font-size:12px; cursor:pointer;" id="close-panel-btn">❌</span></h4>
        
        <div class="radio-group">
            <label><input type="radio" name="exp-mode" value="expand" checked> 🪄 부풀리기</label>
            <label><input type="radio" name="exp-mode" value="polish"> ✍️ 단순 다듬기</label>
        </div>

        <div id="style-ref-wrapper">
            <span class="expand-label" style="margin-top:0;">참고 문체 스타일</span>
            <select id="exp-style-select" class="expand-input" style="font-size: 12px;">
                <option value="기본">선택 안 함 (기본 톤)</option>
                <option value="건조하고 간결한 문체">건조/간결</option>
                <option value="서정적이고 섬세한 문체">서정/섬세</option>
                <option value="위트 있고 비꼬는 듯한 문체">위트/시니컬</option>
                <option value="정통 무협의 비장하고 묵직한 문체">무협/비장</option>
                <option value="코즈믹 호러의 기괴하고 절망적인 문체">호러/절망</option>
                <option value="자조적이고 퇴폐적인 우울한 문체">자조/퇴폐</option>
            </select>
        </div>

        <span class="expand-label">서술 시점</span>
        <div class="radio-group" style="margin-bottom: 4px;">
            <label><input type="radio" name="exp-pov" value="1" checked> 1인칭 (나)</label>
            <label><input type="radio" name="exp-pov" value="3"> 3인칭 (이름 지정)</label>
        </div>
        <input type="text" id="exp-pov-name" class="expand-input" placeholder="이름 (예: 김뤼붕)" style="display:none; margin-bottom: 8px;">

        <span class="expand-label" style="margin-top:0;">분위기 추가</span>
        <div class="tone-container">
            <span class="tone-chip" data-val="로맨스">💕 로맨스</span>
            <span class="tone-chip" data-val="코믹">😂 코믹</span>
            <span class="tone-chip" data-val="액션">⚔️ 액션</span>
            <span class="tone-chip" data-val="스릴러/긴장감">🔪 스릴러</span>
            <span class="tone-chip" data-val="공포/호러">👻 공포</span>
            <span class="tone-chip" data-val="피폐/암울">🌑 피폐</span>
            <span class="tone-chip" data-val="관능적">💋 관능적</span>
            <span class="tone-chip" data-val="일상">☕ 일상</span>
        </div>

        <span class="expand-label">✨ 오감 집중 묘사 (필터)</span>
        <div class="sense-container">
            <span class="sense-chip" data-val="시각(빛, 색채, 눈빛)">👀 시각</span>
            <span class="sense-chip" data-val="청각(숨소리, 배경음, 목소리)">👂 청각</span>
            <span class="sense-chip" data-val="후각(체취, 주변 냄새)">👃 후각</span>
            <span class="sense-chip" data-val="촉각(온도, 질감, 접촉)">✋ 촉각</span>
        </div>

        <span class="expand-label">출력 분량</span>
        <select id="exp-length" class="expand-input">
            <option value="short">짧게 (1~2문단)</option>
            <option value="medium" selected>보통 (3~4문단)</option>
            <option value="long">길게 (아주 디테일하게)</option>
        </select>
        
        <span class="expand-label">대사 (선택)</span>
        <input type="text" id="exp-dialogue" class="expand-input" placeholder='예: 맘대로 해봐.'>
        
        <span class="expand-label" style="display:flex; justify-content:space-between; align-items:flex-end;">
            행동/상황 <span style="font-size:10px; font-weight:normal; color:#888;">(꾹 눌러서 이동가능)</span>
        </span>
        <div class="macro-container" id="macro-btn-container" style="margin-bottom:6px;"></div>
        <textarea id="exp-action" class="expand-input" rows="2" placeholder="행동 지문..."></textarea>
        
        <div class="trpg-container">
            <span class="trpg-chip" data-val="대성공">대성공</span>
            <span class="trpg-chip" data-val="성공">성공</span>
            <span class="trpg-chip active" data-val="기본">결과 자율(기본)</span>
            <span class="trpg-chip" data-val="실패">실패</span>
            <span class="trpg-chip" data-val="대실패">대실패</span>
        </div>

        <!-- 디렉터 모드 (스캐너 제거됨) -->
        <div class="acc-header" data-target="acc-director" style="background:#e8f0fe !important; color:#4A4A8A !important; border-color:#c4b8f5;">
            ▶ 🎬 디렉터 (스토리 통제) 모드
        </div>
        <div id="acc-director" class="acc-content highlight">
            <span class="expand-label" style="margin-top:0;">🥷 스텔스 이야기 유도 (은밀한 떡밥)</span>
            <input type="text" id="exp-director-stealth" class="expand-input" placeholder="예: 비 맞은 걸 보고 상대가 시비 걸게 유도">
            
            <span class="expand-label">⏳ 장면 전환 / 👤 엑스트라 난입</span>
            <div style="display:flex; gap:4px;">
                <input type="text" id="exp-director-scene" class="expand-input" placeholder="장소/시간 (예: 다음날)" style="flex:1;">
                <input type="text" id="exp-director-npc" class="expand-input" placeholder="난입 NPC (예: 알바생)" style="flex:1;">
            </div>
        </div>

        <div class="flex-btns">
            <button id="exp-generate-btn" class="btn-generate">🪄 집필 시작 (Ctrl+Enter)</button>
            <button id="exp-reroll-btn" class="btn-reroll" title="리롤">🔄</button>
        </div>
        <div id="expand-status"></div>

        <span class="expand-label" style="display:flex; justify-content:space-between; align-items:center;">
            완성된 텍스트
            <span id="history-controls">
                <button id="btn-prev-hist">◀</button>
                <span id="hist-idx">1/1</span>
                <button id="btn-next-hist">▶</button>
            </span>
        </span>
        <textarea id="exp-result" class="expand-input" rows="5" placeholder="여기에 결과가 나타납니다."></textarea>
        
        <!-- 다국어 번역 UI -->
        <div class="trans-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-size:11px; font-weight:bold; color:#4A4A8A !important;">🌐 텍스트 다국어 번역</span>
                <select id="trans-format">
                    <option value="only">번역만 (hi)</option>
                    <option value="both">병기 (hi(안녕))</option>
                </select>
            </div>
            <div style="display:flex; gap:4px;">
                <select id="trans-lang" style="flex:1;"></select>
                <button id="btn-trans-drag" class="btn-trans-drag">드래그 번역</button>
                <button id="btn-trans-dia" class="btn-trans-dia">대사 전체 번역</button>
            </div>
        </div>

        <button id="exp-apply-btn" class="btn-apply">💬 채팅창에 자동 전송 (Shift+Enter)</button>

        <div id="exp-toggle-settings" class="toggle-settings">⚙️ 환경, 커스텀, 세계관, 모델 설정 ▾</div>
        <div id="expand-settings-wrapper">
            
            <span class="expand-label" style="margin-top: 0;">👻 패널 투명도 설정</span>
            <label style="font-size:12px; cursor:pointer; color:#61605A !important; display:flex; align-items:center; gap:4px; margin-bottom:6px;">
                <input type="checkbox" id="exp-auto-blur"> 마우스 치우면 자동 반투명화 (투명도 40%)
            </label>
            <div style="display:flex; align-items:center; gap: 8px; font-size:12px; color:#61605A !important; margin-bottom:12px;">
                <span style="white-space:nowrap;">기본 투명도: <span id="opacity-val" style="color:#6A3DE8 !important; font-weight:bold;">100</span>%</span>
                <input type="range" id="exp-opacity-slider" min="20" max="100" value="100" style="flex:1;">
            </div>

            <!-- 아코디언: 매크로 커스텀 -->
            <div class="acc-header" data-target="acc-macro">▶ ⚡ 퀵 매크로 버튼 커스텀</div>
            <div id="acc-macro" class="acc-content">
                <span class="expand-label" style="margin-top:0;">자주 쓰는 행동 (쉼표로 구분)</span>
                <input type="text" id="exp-macro-input" class="expand-input" placeholder="예: 끄덕임, 한숨, 비웃음, 당황, 으쓱">
            </div>

            <!-- 아코디언: 기호 커스텀 -->
            <div class="acc-header" data-target="acc-sym">▶ 🔣 서술/대사 기호 커스텀</div>
            <div id="acc-sym" class="acc-content">
                <div class="sym-inputs">
                    <input type="text" id="sym-act-l" placeholder="서술 시작 (예: *)">
                    <input type="text" id="sym-act-r" placeholder="서술 끝 (예: *)">
                </div>
                <div class="sym-inputs">
                    <input type="text" id="sym-dia-l" placeholder='대사 시작 (예: ")'>
                    <input type="text" id="sym-dia-r" placeholder='대사 끝 (예: ")'>
                </div>
            </div>

            <!-- 아코디언: 로어북 -->
            <div class="acc-header" data-target="acc-lore">▶ 🌍 세계관 사전 (최대 10개)</div>
            <div id="acc-lore" class="acc-content">
                <div class="slots-container">${loreSlotsHTML}</div>
            </div>

            <!-- 아코디언: 기억력 -->
            <div class="acc-header" data-target="acc-mem">▶ 🧠 AI 기억력 (현재 <span id="mem-val-header" style="color:#6A3DE8 !important;">8</span>개 읽음)</div>
            <div id="acc-mem" class="acc-content">
                <div style="display:flex; justify-content:space-between; font-size:11px; color:#61605A !important; margin-bottom:4px; margin-top:4px;">
                    <span>적게 (1개)</span><span>많이 (20개)</span>
                </div>
                <div style="display:flex; align-items:center; gap: 10px;">
                    <input type="range" id="exp-memory-slider" min="1" max="20" value="8" style="flex:1;">
                    <span style="font-size:15px; font-weight:bold; color:#FF4432 !important; width:40px; text-align:right;"><span id="mem-val-inner">8</span>개</span>
                </div>
            </div>

            <!-- 아코디언: 프로필 -->
            <div class="acc-header" data-target="acc-char">▶ 👤 캐릭터 프로필 (최대 10개)</div>
            <div id="acc-char" class="acc-content">
                <div class="slots-container">${charSlotsHTML}</div>
            </div>
            
            <!-- 아코디언: API 키 & 모델 -->
            <div class="acc-header" data-target="acc-api">▶ 🔑 API 키 & 제미나이 모델 설정</div>
            <div id="acc-api" class="acc-content">

                <span class="expand-label" style="margin-top:0;">API 제공자 선택</span>
                <select id="exp-api-provider" class="expand-input" style="margin-bottom: 8px;">
                    <option value="aistudio">Google AI Studio (기본)</option>
                    <option value="firebase">Firebase Vertex AI</option>
                </select>

                <span class="expand-label" style="margin-top:0;">API 키</span>
                <input type="text" id="exp-api-key" class="expand-input" placeholder="API 키 입력">

                <div id="firebase-options" style="display:none; padding:8px; background:#F0F0EE !important; border-radius:4px; margin-top:4px; margin-bottom:4px;">
                    <span class="expand-label" style="margin-top:0;">Firebase Vertex AI 스크립트 (JSON 키 아님!)</span>
                    <div style="font-size:11px; color:#FF4432; margin-bottom:4px; font-weight:bold;">
                        ※ 주의: Google Cloud의 JSON 키 파일 내용이 아닙니다!<br>
                        Firebase 콘솔 설정에서 제공하는 <code>firebaseConfig = { ... };</code> 형태의 자바스크립트 내용 전체를 복사해서 넣어주세요.
                    </div>
                    <textarea id="exp-fb-script" class="expand-input" rows="3" placeholder="firebaseConfig = { ... }; 형식의 스크립트를 입력해주세요."></textarea>
                </div>

                <span class="expand-label">제미나이 모델</span>
                <select id="exp-model-select" class="expand-input">
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview (최고 지능/권장)</option>
                    <option value="gemini-3-flash-preview">Gemini 3.0 Flash Preview</option>
                    <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash-Lite</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (빠름/가벼움)</option>
                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                </select>
            </div>
            
            <div class="flex-btns">
                <button id="exp-save-btn" style="background-color: #4A4A8A;">설정 저장하기</button>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    // =============================================
    //  요소 참조 및 초기값 로드
    // =============================================
    const dialogueInput   = document.getElementById('exp-dialogue');
    const actionInput     = document.getElementById('exp-action');
    const resultInput     = document.getElementById('exp-result');
    const statusBox       = document.getElementById('expand-status');
    
    // 디렉터 모드 요소
    const dirStealthInput = document.getElementById('exp-director-stealth');
    const dirSceneInput   = document.getElementById('exp-director-scene');
    const dirNpcInput     = document.getElementById('exp-director-npc');
    const senseChips      = document.querySelectorAll('.sense-chip');

    // 시점(POV) 관련
    const povRadios = document.getElementsByName('exp-pov');
    const povNameInput = document.getElementById('exp-pov-name');
    const savedPovMode = GM_getValue('expPovMode', '1');
    Array.from(povRadios).forEach(r => { if (r.value === savedPovMode) r.checked = true; });
    povNameInput.value = GM_getValue('expPovName', '');
    function updatePovUI() {
        const povMode = document.querySelector('input[name="exp-pov"]:checked').value;
        povNameInput.style.display = (povMode === '3') ? 'block' : 'none';
    }
    updatePovUI();
    Array.from(povRadios).forEach(r => r.addEventListener('change', () => { updatePovUI(); GM_setValue('expPovMode', r.value); }));
    povNameInput.addEventListener('input', () => GM_setValue('expPovName', povNameInput.value));

    // API & 모델
    const apiKeyInput     = document.getElementById('exp-api-key');
    const modelSelect     = document.getElementById('exp-model-select');
    const providerSelect  = document.getElementById('exp-api-provider');
    const fbScriptInput   = document.getElementById('exp-fb-script'); // 변경됨
    const fbOptionsDiv    = document.getElementById('firebase-options');

    //저장된 값 로드
    apiKeyInput.value     = GM_getValue('apiKey', '');
    modelSelect.value     = GM_getValue('expModel', 'gemini-3.1-pro-preview');
    providerSelect.value  = GM_getValue('apiProvider', 'aistudio');
    fbProjectInput.value  = GM_getValue('fbProject', '');
    fbScriptInput.value   = GM_getValue('fbScript', ''); // 변경됨

    // 제공자에 따라 firebase 옵션 보이기
    function updateProviderUI() {
        if (providerSelect.value === 'firebase') {
            fbOptionsDiv.style.display = 'block';
        } else {
            fbOptionsDiv.style.display = 'none';
        }
    }
    providerSelect.addEventListener('change', updateProviderUI);
    updateProviderUI(); // 처음 스크립트 실행 시 1회 켜주기
    
    const lengthSelect    = document.getElementById('exp-length');
    const styleSelect     = document.getElementById('exp-style-select');
    styleSelect.value     = GM_getValue('expStyle', '기본');
    const modeRadios      = document.getElementsByName('exp-mode');
    const toneChips       = document.querySelectorAll('.tone-chip');
    const trpgChips       = document.querySelectorAll('.trpg-chip');
    
    // 기호 커스텀
    const symActL = document.getElementById('sym-act-l'); const symActR = document.getElementById('sym-act-r');
    const symDiaL = document.getElementById('sym-dia-l'); const symDiaR = document.getElementById('sym-dia-r');
    symActL.value = GM_getValue('symActL', '*'); symActR.value = GM_getValue('symActR', '*');
    symDiaL.value = GM_getValue('symDiaL', '"'); symDiaR.value = GM_getValue('symDiaR', '"');

    // 번역기 언어 리스트 구성
    const transLangSelect = document.getElementById('trans-lang');
    const transFormatSelect = document.getElementById('trans-format');
    transFormatSelect.value = GM_getValue('transFormat', 'only');
    
    let pinnedLang = GM_getValue('pinnedLang', 'en');
    function renderTransLangs() {
        transLangSelect.innerHTML = '';
        const pinnedObj = SUPPORTED_LANGS.find(l => l.v === pinnedLang) || SUPPORTED_LANGS[0];
        const pinnedOpt = document.createElement('option');
        pinnedOpt.value = pinnedObj.v; pinnedOpt.textContent = `⭐ ${pinnedObj.t}`;
        transLangSelect.appendChild(pinnedOpt);
        
        SUPPORTED_LANGS.forEach(l => {
            if (l.v !== pinnedLang) {
                const opt = document.createElement('option');
                opt.value = l.v; opt.textContent = l.t;
                transLangSelect.appendChild(opt);
            }
        });
        transLangSelect.value = pinnedLang;
    }
    renderTransLangs();
    transFormatSelect.addEventListener('change', () => GM_setValue('transFormat', transFormatSelect.value));

    // 오감 필터 칩
    senseChips.forEach(chip => { chip.addEventListener('click', () => chip.classList.toggle('active')); });

    // 퀵 매크로 로드 및 렌더링
    const macroInput = document.getElementById('exp-macro-input');
    let isMacroDragging = false;
    function renderMacroChips() {
        const container = document.getElementById('macro-btn-container');
        const rawVal = GM_getValue('expMacros', '끄덕임, 한숨, 비웃음, 당황, 으쓱');
        macroInput.value = rawVal;
        const macros = rawVal.split(',').map(s => s.trim()).filter(s => s);
        container.innerHTML = '';
        macros.forEach(m => {
            const span = document.createElement('span');
            span.className = 'macro-chip'; span.textContent = m; span.draggable = true;
            span.addEventListener('click', (e) => {
                if (isMacroDragging) return;
                let val = actionInput.value;
                if (val && !val.endsWith(' ') && !val.endsWith(', ') && !val.endsWith(',')) val += ' ';
                actionInput.value = val + m + ', ';
                actionInput.focus();
            });
            span.addEventListener('dragstart', function(e) {
                isMacroDragging = true; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', m);
                this.classList.add('dragging-macro'); setTimeout(() => this.style.opacity = '0.4', 0);
            });
            span.addEventListener('dragend', function() {
                this.style.opacity = '1'; this.classList.remove('dragging-macro');
                saveMacroOrder(); setTimeout(() => isMacroDragging = false, 100);
            });
            span.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
            span.addEventListener('drop', function(e) {
                e.stopPropagation(); const dragged = container.querySelector('.dragging-macro');
                if (dragged && dragged !== this) {
                    const children = Array.from(container.children);
                    if (children.indexOf(dragged) < children.indexOf(this)) this.after(dragged); else this.before(dragged);
                }
                return false;
            });
            container.appendChild(span);
        });
    }
    function saveMacroOrder() {
        const container = document.getElementById('macro-btn-container');
        const newOrder = Array.from(container.querySelectorAll('.macro-chip')).map(c => c.textContent).join(', ');
        GM_setValue('expMacros', newOrder); macroInput.value = newOrder;
    }
    renderMacroChips();

    trpgChips.forEach(chip => {
        chip.addEventListener('click', () => { trpgChips.forEach(c => c.classList.remove('active')); chip.classList.add('active'); });
    });

    let genHistory =[]; let histIdx = -1;
    const historyControls = document.getElementById('history-controls');
    const histIdxText     = document.getElementById('hist-idx');

    const memorySlider = document.getElementById('exp-memory-slider');
    const memValHeader = document.getElementById('mem-val-header');
    const memValInner  = document.getElementById('mem-val-inner');
    const savedMem = GM_getValue('expMemory', 8);
    memorySlider.value = savedMem;
    if(memValHeader) memValHeader.textContent = savedMem;
    if(memValInner) memValInner.textContent = savedMem;
    memorySlider.addEventListener('input', () => { 
        if(memValHeader) memValHeader.textContent = memorySlider.value;
        if(memValInner) memValInner.textContent = memorySlider.value;
    });

    const autoBlurCb    = document.getElementById('exp-auto-blur');
    const opacitySlider = document.getElementById('exp-opacity-slider');
    const opacityVal    = document.getElementById('opacity-val');
    const savedAutoBlur = GM_getValue('expAutoBlur', true);
    const savedOpacity  = GM_getValue('expOpacity', 100);
    
    autoBlurCb.checked  = savedAutoBlur; opacitySlider.value = savedOpacity; opacityVal.textContent = savedOpacity;
    panel.style.setProperty('--base-opacity', savedOpacity / 100);
    if (savedAutoBlur) panel.classList.add('auto-blur');
    opacitySlider.addEventListener('input', () => {
        opacityVal.textContent = opacitySlider.value; panel.style.setProperty('--base-opacity', opacitySlider.value / 100);
    });
    autoBlurCb.addEventListener('change', () => {
        if (autoBlurCb.checked) panel.classList.add('auto-blur'); else panel.classList.remove('auto-blur');
    });

    lengthSelect.value = GM_getValue('expLength', 'medium');
    
    for (let i = 1; i <= 10; i++) {
        const ccb = document.getElementById(`char-active-${i}`); const cta = document.getElementById(`char-text-${i}`);
        if (ccb) ccb.checked = GM_getValue(`charActive${i}`, false); if (cta) cta.value = GM_getValue(`charText${i}`, '');
        const lcb = document.getElementById(`lore-active-${i}`); const lta = document.getElementById(`lore-text-${i}`);
        if (lcb) lcb.checked = GM_getValue(`loreActive${i}`, false); if (lta) lta.value = GM_getValue(`loreText${i}`, '');
    }
    
    const savedMode = GM_getValue('expMode', 'expand');
    Array.from(modeRadios).forEach(r => { if (r.value === savedMode) r.checked = true; });

    const savedTones = JSON.parse(GM_getValue('expTones', '[]'));
    toneChips.forEach(chip => {
        if (savedTones.includes(chip.dataset.val)) chip.classList.add('active');
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            const activeVals = Array.from(document.querySelectorAll('.tone-chip.active')).map(c => c.dataset.val);
            GM_setValue('expTones', JSON.stringify(activeVals));
        });
    });

    // 아코디언 토글
    document.querySelectorAll('.acc-header').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.getAttribute('data-target'); const content = document.getElementById(targetId);
            const isOpen = content.classList.contains('open');
            if(isOpen) { content.classList.remove('open'); header.innerHTML = header.innerHTML.replace('▼', '▶'); } 
            else { content.classList.add('open'); header.innerHTML = header.innerHTML.replace('▶', '▼'); }
        });
    });

    // 드래그
    const savedBtnLeft = GM_getValue('expBtnLeft', null); const savedBtnTop = GM_getValue('expBtnTop', null);
    if (savedBtnLeft !== null && savedBtnTop !== null) {
        toggleBtn.style.left = savedBtnLeft + 'px'; toggleBtn.style.top = savedBtnTop + 'px';
        toggleBtn.style.right = 'auto'; toggleBtn.style.bottom = 'auto';
    }

    let isBtnDragging = false, hasBtnDragged = false, btnPressTimer = null;
    let startX, startY, initialLeft, initialTop;
    function startBtnDrag(e) {
        hasBtnDragged = false;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = toggleBtn.getBoundingClientRect(); startX = clientX; startY = clientY; initialLeft = rect.left; initialTop = rect.top;
        btnPressTimer = setTimeout(() => { isBtnDragging = true; toggleBtn.classList.add('dragging'); }, 400);
    }
    function doBtnDrag(e) {
        if (!isBtnDragging) { clearTimeout(btnPressTimer); return; }
        e.preventDefault(); hasBtnDragged = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        let newLeft = Math.max(0, Math.min(initialLeft + (clientX - startX), window.innerWidth - toggleBtn.offsetWidth));
        let newTop = Math.max(0, Math.min(initialTop + (clientY - startY), window.innerHeight - toggleBtn.offsetHeight));
        toggleBtn.style.left = newLeft + 'px'; toggleBtn.style.top = newTop + 'px';
        toggleBtn.style.right = 'auto'; toggleBtn.style.bottom = 'auto';
    }
    function endBtnDrag() {
        clearTimeout(btnPressTimer);
        if (isBtnDragging) {
            isBtnDragging = false; toggleBtn.classList.remove('dragging');
            GM_setValue('expBtnLeft', parseInt(toggleBtn.style.left)); GM_setValue('expBtnTop', parseInt(toggleBtn.style.top));
        }
    }
    toggleBtn.addEventListener('touchstart', startBtnDrag, { passive: false });
    toggleBtn.addEventListener('touchmove', doBtnDrag, { passive: false });
    toggleBtn.addEventListener('touchend', endBtnDrag);
    toggleBtn.addEventListener('mousedown', startBtnDrag);
    document.addEventListener('mousemove', doBtnDrag);
    document.addEventListener('mouseup', endBtnDrag);

    // API 토큰 헬퍼
    function buildHeaders() {
        const token = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('access_token='))?.slice(13) || null;
        const wrtnId = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('__w_id='))?.slice(7) || '';
        const h = { 'Content-Type': 'application/json', 'platform': 'web', 'wrtn-locale': 'ko-KR' };
        if (token) h['Authorization'] = `Bearer ${token}`; if (wrtnId) h['x-wrtn-id'] = wrtnId; return h;
    }
    function parsePath() { const m = location.pathname.match(/\/stories\/([^/]+)\/episodes\/([^/]+)/); return m ? { storyId: m[1], chatId: m[2] } : null; }
    
    async function fetchChatHistory(chatId, limitStr) {
        try {
            const limit = parseInt(limitStr) || 8;
            const res = await fetch(`${API_BASE}/v3/chats/${chatId}/messages?limit=${limit}`, { headers: buildHeaders(), credentials: 'include' });
            if (!res.ok) throw new Error();
            const json = await res.json();
            const msgs = (json.data ?? json).messages ??[];
            return msgs.slice(0, limit).reverse().map(m => `[${m.role === 'assistant' ? '상대/AI' : '나/사용자'}]: ${m.content}`).join('\n\n');
        } catch (e) { return "(맥락 없음)"; }
    }

    // =============================================
    //  번역 모듈 (드래그 및 자동 대사)
    // =============================================
    function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    async function executeTranslation(type) {
        const apiKey = GM_getValue('apiKey', '').trim();
        const provider = GM_getValue('apiProvider', 'aistudio');
        const fbScript = GM_getValue('fbScript', '').trim(); // 변경됨
        const selectedModel = modelSelect.value || 'gemini-3.1-pro-preview';

        if (provider === 'aistudio' && !apiKey) { alert('API 키를 입력해주세요.'); return; }
        if (provider === 'firebase' && !fbScript) { alert('Firebase 스크립트를 입력해주세요.'); return; }

        let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

        const langCode = transLangSelect.value;
        const langName = transLangSelect.options[transLangSelect.selectedIndex].text.replace('⭐', '').trim();
        const format = transFormatSelect.value;
        
        pinnedLang = langCode; GM_setValue('pinnedLang', pinnedLang); renderTransLangs();

        const btnDrag = document.getElementById('btn-trans-drag');
        const btnDia = document.getElementById('btn-trans-dia');
        btnDrag.disabled = true; btnDia.disabled = true;
        statusBox.textContent = '🌐 텍스트 번역 중...';

        try {
            let sysPrompt = ''; let userContent = '';

            if (type === 'drag') {
                const start = resultInput.selectionStart; const end = resultInput.selectionEnd;
                if (start === end) throw new Error('번역할 텍스트를 마우스로 드래그(블록 지정) 해주세요.');
                
                const selectedText = resultInput.value.substring(start, end);
                sysPrompt = `You are a professional translator. Translate the given text into ${langName}. If FORMAT is 'only': Output only the translated text. If FORMAT is 'both': Output "TranslatedText(OriginalText)". Keep exact spacing/punctuation. DO NOT add markdown or extra explanations. Output raw text.`;
                userContent = `FORMAT: ${format}\nTEXT TO TRANSLATE:\n${selectedText}`;

                let res = '';
                if (provider === 'firebase') {
                    res = await runFirebaseVertexAI(fbScript, selectedModel, sysPrompt, userContent);
                } else {
                    res = await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'POST', url: apiUrl, headers: { 'Content-Type': 'application/json' },
                            data: JSON.stringify({ system_instruction: { parts:[{text: sysPrompt}] }, contents:[{ parts:[{text: userContent}] }], generationConfig: { temperature: 0.3 } }),
                            onload(r) { try { const d = JSON.parse(r.responseText); if(d.error) reject(new Error(d.error.message)); else resolve(d.candidates[0].content.parts[0].text.trim()); } catch(e){ reject(e); } },
                            onerror() { reject(new Error('네트워크 오류')); }
                        });
                    });
                }
                resultInput.value = resultInput.value.substring(0, start) + res + resultInput.value.substring(end);
            
            } else if (type === 'dialogue') {
                const dL = symDiaL.value || '"'; const dR = symDiaR.value || '"';
                const regex = new RegExp(`${escapeRegExp(dL)}(.*?)${escapeRegExp(dR)}`, 'g');
                
                const matches =[]; let match;
                while ((match = regex.exec(resultInput.value)) !== null) { matches.push(match[1]); }
                if (matches.length === 0) throw new Error('텍스트에서 대사를 찾을 수 없습니다.');

                sysPrompt = `You are a professional translator. Translate the given JSON array of strings into ${langName}. If FORMAT is 'only': Translate the string directly. If FORMAT is 'both': Format each string as "TranslatedText(OriginalText)". CRITICAL: Output ONLY a valid JSON array of strings. The length of the array must perfectly match the input array. No markdown blocks like \`\`\`json.`;
                userContent = `FORMAT: ${format}\nINPUT JSON ARRAY:\n${JSON.stringify(matches)}`;

                let res = '';
                if (provider === 'firebase') {
                    res = await runFirebaseVertexAI(fbScript, selectedModel, sysPrompt, userContent);
                } else {
                    res = await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'POST', url: apiUrl, headers: { 'Content-Type': 'application/json' },
                            data: JSON.stringify({ system_instruction: { parts:[{text: sysPrompt}] }, contents:[{ parts:[{text: userContent}] }], generationConfig: { temperature: 0.3 } }),
                            onload(r) { try { const d = JSON.parse(r.responseText); if(d.error) reject(new Error(d.error.message)); else resolve(d.candidates[0].content.parts[0].text.trim()); } catch(e){ reject(e); } },
                            onerror() { reject(new Error('네트워크 오류')); }
                        });
                    });
                }

                let translatedArr =[];
                try { translatedArr = JSON.parse(resStr.replace(/^```[^\n]*\n([\s\S]*?)\n```\s*$/m, '$1')); } 
                catch(e) { throw new Error('번역 결과를 배열로 처리하는 데 실패했습니다.'); }

                let i = 0;
                resultInput.value = resultInput.value.replace(regex, (fullMatch, p1) => {
                    if(i < translatedArr.length) { const replaced = `${dL}${translatedArr[i]}${dR}`; i++; return replaced; }
                    return fullMatch;
                });
            }
            statusBox.style.color = 'green'; statusBox.textContent = '🌐 번역이 완료되었습니다!';
        } catch (e) {
            statusBox.style.color = 'red'; statusBox.textContent = `❌ ${e.message}`;
        } finally {
            btnDrag.disabled = false; btnDia.disabled = false;
        }
    }

    // =============================================
    //  Firebase Vertex AI 엔진 (사용중 파일 이식)
    // =============================================
    function parseVertexContent(scriptStr) {
        try {
            const match = scriptStr.match(/firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
            if (match && match[1]) { return new Function("return " + match[1])(); }
            if (scriptStr.includes("apiKey")) {
                const startText = "firebaseConfig = {";
                const startIndex = scriptStr.indexOf(startText);
                if (startIndex !== -1) {
                    const endIndex = scriptStr.indexOf("}", startIndex);
                    if (endIndex !== -1) {
                        const objStr = scriptStr.substring(startIndex + startText.length - 1, endIndex + 1);
                        return new Function("return " + objStr)();
                    }
                }
            }
        } catch(e) {}
        return null;
    }

    async function runFirebaseVertexAI(scriptStr, modelId, sysPrompt, userContent) {
        const config = parseVertexContent(scriptStr);
        if (!config) { throw new Error("Firebase 스크립트 형식이 올바르지 않습니다. firebaseConfig = { ... }; 부분을 포함해주세요."); }
        
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js");
        const { getAI, getGenerativeModel, VertexAIBackend, HarmBlockThreshold, HarmCategory } = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-ai.js");

        let app;
        try { app = initializeApp(config, "crack-ext-" + Date.now()); } 
        catch(e) { throw new Error("Firebase 초기화 실패: " + e.message); }

        const ai = getAI(app, { backend: new VertexAIBackend('global') });
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.OFF },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.OFF },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.OFF },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.OFF }
        ];

        const modelWithSys = getGenerativeModel(ai, { model: modelId, systemInstruction: sysPrompt, safetySettings });
        const result = await modelWithSys.generateContent(userContent);
        const response = await result.response;
        return response.text();
    }

    document.getElementById('btn-trans-drag').addEventListener('click', () => executeTranslation('drag'));
    document.getElementById('btn-trans-dia').addEventListener('click', () => executeTranslation('dialogue'));

    // =============================================
    //  AI 호출 (프롬프트 동적 조립)
    // =============================================
    async function callGemini(dialogue, action, chatHistory) {
        const apiKey = GM_getValue('apiKey', '').trim();
        const provider = GM_getValue('apiProvider', 'aistudio');
        const fbScript = GM_getValue('fbScript', '').trim(); // 변경됨
        const selectedModel = modelSelect.value || 'gemini-3.1-pro-preview';

        if (provider === 'aistudio' && !apiKey) { throw new Error('API 키를 입력해주세요.'); }
        if (provider === 'firebase' && !fbScript) { throw new Error('Firebase 스크립트를 입력해주세요.'); }

        let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

            const activeTones = Array.from(document.querySelectorAll('.tone-chip.active')).map(c => c.dataset.val).join(', ');
            const len = lengthSelect.value;
            const mode = document.querySelector('input[name="exp-mode"]:checked').value;
            const style = styleSelect.value; 
            
            const trpgResult = document.querySelector('.trpg-chip.active').dataset.val;
            const aL = symActL.value || '*'; const aR = symActR.value || '*';
            const dL = symDiaL.value || '"'; const dR = symDiaR.value || '"';

            const stealthDir = dirStealthInput.value.trim();
            const sceneDir = dirSceneInput.value.trim();
            const npcDir = dirNpcInput.value.trim();
            const activeSenses = Array.from(document.querySelectorAll('.sense-chip.active')).map(c => c.dataset.val).join(', ');

            // 시점 로직
            const povMode = document.querySelector('input[name="exp-pov"]:checked').value;
            const povName = document.getElementById('exp-pov-name').value.trim();
            let povInstruction = "";
            if (povMode === '1') povInstruction = "1. 시점 지정: 철저하게 사용자 캐릭터 중심의 1인칭('나') 시점으로 서술하십시오. 대명사 '나'를 사용하여 사용자의 시선과 내면을 묘사하십시오.\n";
            else { const name = povName || "사용자 캐릭터"; povInstruction = `1. 시점 지정: 철저하게 '${name}' 중심의 3인칭 시점으로 서술하십시오. 서술 시 1인칭 대명사('나')를 쓰지 말고, '${name}'의 관점에서 행동과 내면을 묘사하십시오.\n`; }

            const activeChars =[]; const activeLores =[];
            for (let i = 1; i <= 10; i++) {
                const ccb = document.getElementById(`char-active-${i}`); const cta = document.getElementById(`char-text-${i}`);
                if (ccb && ccb.checked && cta && cta.value.trim()) activeChars.push(cta.value.trim());
                const lcb = document.getElementById(`lore-active-${i}`); const lta = document.getElementById(`lore-text-${i}`);
                if (lcb && lcb.checked && lta && lta.value.trim()) activeLores.push(lta.value.trim());
            }
            const combinedCharSettings = activeChars.join('\n\n');
            const combinedLoreSettings = activeLores.join('\n\n');

            let sysPrompt = `[역할 및 목적]\n당신은 사용자의 입력을 바탕으로 완벽한 롤플레잉 텍스트를 작성하는 '초월 작가'입니다.\n\n[작성 원칙: 시점, 양식, 타 캐릭터 조종 방지]\n${povInstruction}`;
            sysPrompt += `2. 기호/양식 엄수 및 줄바꿈: 행동 지문과 서술/묘사는 반드시 ${aL} 와(과) ${aR} 기호로 감싸고, 대사는 반드시 ${dL} 와(과) ${dR} 기호로 감싸십시오. **서술과 대사 사이에는 반드시 줄바꿈(엔터)을 넣어 문단을 명확히 분리하십시오.**\n   - 예시:\n   ${aL}어이없다는 듯 웃으며 고개를 젓는다.${aR}\n   ${dL}무슨 수작이야?${dR}\n`;
            sysPrompt += `3. 타 캐릭터 조종 방지: 상대방(NPC)의 대사를 임의로 지어내거나 깊은 내면을 서술하지 마십시오. 상대방의 행동은 사용자의 시야에 보이는 객관적이고 짧은 리액션 정도로 제한하십시오.\n4. 부연 설명이나 인사말 없이 오직 롤플레잉 본문만 출력하십시오.\n\n`;

            if (combinedLoreSettings) sysPrompt += `[🌍 절대적 세계관/설정 규칙]\n${combinedLoreSettings}\n(위 설정은 세계관의 진리이므로 묘사 시 절대 위반하지 말 것)\n\n`;
            if (combinedCharSettings) sysPrompt += `[내 캐릭터 고정 설정]\n${combinedCharSettings}\n(반드시 반영)\n\n`;
            if (activeTones) sysPrompt += `[요구되는 분위기/톤]\n서술에 융합할 것: ${activeTones}\n\n`;

            // 디렉터 모드 & 오감 프롬프트 삽입
            if (stealthDir) sysPrompt += `[🥷 스텔스 이야기 유도 지시]\n다음 턴에 상대방 AI가 반드시 "${stealthDir}" 하게 반응하거나 행동할 수밖에 없도록, 내 행동과 묘사 속에 아주 교묘하고 강력한 떡밥(미끼)을 깔아둘 것. 절대 OOC나 괄호를 이용한 시스템 명령을 대놓고 쓰지 말고, 오직 '소설적 묘사와 행동의 디테일'만으로 상황을 강제 유도할 것.\n\n`;
            if (sceneDir) sysPrompt += `[⏳ 장면 전환 지시]\n시간이나 장소가 "${sceneDir}" (으)로 전환됨을 알리십시오. 이전 상황을 스무스하게 정리하고 새로운 배경과 분위기가 시작되는 묘사를 자연스럽게 포함할 것.\n\n`;
            if (npcDir) sysPrompt += `[👤 엑스트라 난입 지시]\n묘사 도중, "${npcDir}" 이(가) 불쑥 개입하거나 등장하여 현재 상황에 영향을 미치는 연출을 추가할 것.\n\n`;
            if (activeSenses) sysPrompt += `[✨ 오감 집중 묘사 필터]\n서술 시 다음 감각을 극대화하여 영화처럼 생생하고 디테일하게 묘사할 것: ${activeSenses}\n\n`;

            if (trpgResult !== '기본') {
                sysPrompt += `[🎲 TRPG 주사위 결과 강제 적용]: 사용자의 행동(시도)에 대해 무조건 **[${trpgResult}]**의 결과가 나오도록 서술하십시오. 상황의 극적인 성공 또는 실패를 묘사하십시오.\n\n`;
            }

            if (mode === 'polish') sysPrompt += `[작업 모드: 단순 다듬기(윤문)]\n의미와 흐름을 유지하며 문장만 세련되게 다듬을 것.\n`;
            else sysPrompt += `[작업 모드: 적극적 확장(부풀리기)]\n감정, 주변 묘사, 오감 디테일을 풍부하고 화려하게 살려 살을 붙일 것.\n`;

            if (style !== '기본') sysPrompt += `[문체 스타일 지시]\n다음 문체를 적극 참고: ${style}\n\n`;
            else sysPrompt += `\n`;

            if (len === 'short') sysPrompt += `[분량 제한]: 간결하게 1~2문단 내외로 짧게 작성.\n`;
            else if (len === 'medium') sysPrompt += `[분량 제한]: 적당한 분량(3~4문단)으로 작성.\n`;
            else if (len === 'long') sysPrompt += `[분량 제한]: 아주 길고 디테일하게, 풍성한 묘사로 작성.\n`;

            const userContent = `[최근 대화 맥락]\n${chatHistory}\n\n====================\n\n[사용자의 지시]\n대사: ${dialogue || "(없음)"}\n행동/상황: ${action || "(없음)"}`;

            if (provider === 'firebase') {
            // Firebase Vertex AI 호출
            let raw = await runFirebaseVertexAI(fbScript, selectedModel, sysPrompt, userContent);
            return raw.replace(/^```[^\n]*\n([\s\S]*?)\n```\s*$/m, '$1').trim();
        } else {
            // Google AI Studio 호출
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST', url: apiUrl, headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({ system_instruction: { parts:[{ text: sysPrompt }] }, contents:[{ parts:[{ text: userContent }] }], generationConfig: { temperature: 0.8 } }),
                    onload(res) {
                        try {
                            const data = JSON.parse(res.responseText);
                            if (data.error) { reject(new Error(data.error.message)); return; }
                            let raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                            resolve(raw.replace(/^```[^\n]*\n([\s\S]*?)\n```\s*$/m, '$1').trim());
                        } catch (e) { reject(e); }
                    },
                    onerror() { reject(new Error('네트워크 오류가 발생했습니다.')); }
                });
            });
        }
    }

    function updateHistoryUI() {
        if (genHistory.length <= 1) { historyControls.style.display = 'none'; } 
        else { historyControls.style.display = 'inline-block'; histIdxText.textContent = `${histIdx + 1}/${genHistory.length}`; }
    }

    // =============================================
    //  메인 실행
    // =============================================
    async function runAI() {
        const dText = dialogueInput.value.trim();
        const aText = actionInput.value.trim();
        if (!dText && !aText) { statusBox.style.color = 'red'; statusBox.textContent = '대사나 행동 중 하나는 입력해야 합니다!'; return; }

        const genBtn = document.getElementById('exp-generate-btn');
        const rerollBtn = document.getElementById('exp-reroll-btn');
        genBtn.disabled = true; rerollBtn.disabled = true;
        resultInput.value = '';
        
        try {
            const pathInfo = parsePath();
            let historyStr = "(채팅 맥락 없음)";

            if (pathInfo && pathInfo.chatId) {
                statusBox.style.color = '#4A4A8A !important'; statusBox.textContent = '🔍 이전 대화 맥락 분석 중...';
                historyStr = await fetchChatHistory(pathInfo.chatId, memorySlider.value);
            }

            statusBox.textContent = '⏳ 작가님(AI)이 집필 중...';
            const resultText = await callGemini(dText, aText, historyStr);
            
            resultInput.value = resultText;
            
            navigator.clipboard.writeText(resultText).catch(() => {});
            statusBox.style.color = 'green'; 
            statusBox.textContent = '✨ 집필 완료! (클립보드 자동 복사됨)';

            genHistory = genHistory.slice(0, histIdx + 1);
            genHistory.push(resultText);
            if (genHistory.length > 5) genHistory.shift();
            histIdx = genHistory.length - 1;
            updateHistoryUI();

        } catch (err) {
            statusBox.style.color = 'red'; statusBox.textContent = `❌ ${err.message}`;
        } finally {
            genBtn.disabled = false; rerollBtn.disabled = false;
        }
    }

    // =============================================
    //  이벤트 리스너 모음
    // =============================================
    toggleBtn.addEventListener('click', () => {
        if (hasBtnDragged) { hasBtnDragged = false; return; }
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    });
    document.getElementById('close-panel-btn').addEventListener('click', () => { panel.style.display = 'none'; });

    document.getElementById('exp-toggle-settings').addEventListener('click', () => {
        const wrap = document.getElementById('expand-settings-wrapper');
        wrap.style.display = (wrap.style.display === 'none' || wrap.style.display === '') ? 'block' : 'none';
    });

    Array.from(modeRadios).forEach(r => { r.addEventListener('change', (e) => GM_setValue('expMode', e.target.value)); });
    styleSelect.addEventListener('change', () => GM_setValue('expStyle', styleSelect.value));
    lengthSelect.addEventListener('change', () => GM_setValue('expLength', lengthSelect.value));

    document.getElementById('btn-prev-hist').addEventListener('click', () => {
        if (histIdx > 0) { histIdx--; resultInput.value = genHistory[histIdx]; updateHistoryUI(); }
    });
    document.getElementById('btn-next-hist').addEventListener('click', () => {
        if (histIdx < genHistory.length - 1) { histIdx++; resultInput.value = genHistory[histIdx]; updateHistoryUI(); }
    });

    document.getElementById('exp-save-btn').addEventListener('click', (e) => {
        GM_setValue('apiKey', apiKeyInput.value.trim()); 
        GM_setValue('expModel', modelSelect.value);
        GM_setValue('expMemory', memorySlider.value);
        GM_setValue('expAutoBlur', autoBlurCb.checked);
        GM_setValue('expOpacity', opacitySlider.value);
        GM_setValue('apiProvider', providerSelect.value);
        GM_setValue('fbScript', fbScriptInput.value.trim()); // 변경됨
        
        GM_setValue('expMacros', macroInput.value.trim());
        GM_setValue('symActL', symActL.value); GM_setValue('symActR', symActR.value);
        GM_setValue('symDiaL', symDiaL.value); GM_setValue('symDiaR', symDiaR.value);

        for (let i = 1; i <= 10; i++) {
            const ccb = document.getElementById(`char-active-${i}`); const cta = document.getElementById(`char-text-${i}`);
            if (ccb) GM_setValue(`charActive${i}`, ccb.checked); if (cta) GM_setValue(`charText${i}`, cta.value.trim());
            const lcb = document.getElementById(`lore-active-${i}`); const lta = document.getElementById(`lore-text-${i}`);
            if (lcb) GM_setValue(`loreActive${i}`, lcb.checked); if (lta) GM_setValue(`loreText${i}`, lta.value.trim());
        }
        renderMacroChips();
        e.target.textContent = '저장 완료!';
        setTimeout(() => { e.target.textContent = '설정 저장하기'; }, 1200);
    });

    document.getElementById('exp-generate-btn').addEventListener('click', runAI);
    document.getElementById('exp-reroll-btn').addEventListener('click', runAI);

    document.getElementById('exp-apply-btn').addEventListener('click', () => {
        const textToInsert = resultInput.value.trim();
        if (!textToInsert) return;

        const chatInput = document.querySelector('textarea[placeholder*="메시지"], textarea'); 
        if (chatInput) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
            setter.call(chatInput, textToInsert);
            chatInput.dispatchEvent(new Event('input', { bubbles: true }));
            chatInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            setTimeout(() => {
                chatInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            }, 50);

            statusBox.style.color = 'blue !important'; statusBox.textContent = '💬 채팅창에 전송 완료!';
            dialogueInput.value = ''; actionInput.value = '';
            
            trpgChips.forEach(c => c.classList.remove('active'));
            document.querySelector('.trpg-chip[data-val="기본"]').classList.add('active');
            
            dirStealthInput.value = ''; dirSceneInput.value = ''; dirNpcInput.value = '';
            senseChips.forEach(c => c.classList.remove('active'));

            chatInput.focus();
        } else {
            alert('입력창을 찾을 수 없어 클립보드에 복사되었습니다.');
        }
    });

    panel.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); document.getElementById('exp-generate-btn').click(); } 
        else if (e.shiftKey && e.key === 'Enter') { e.preventDefault(); document.getElementById('exp-apply-btn').click(); }
    });

})();

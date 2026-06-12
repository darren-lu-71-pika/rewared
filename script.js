const unlockButton = document.querySelector("#unlockButton");
const hintText = document.querySelector("#hintText");
const rewardPanel = document.querySelector("#rewardPanel");
const rewardMessage = document.querySelector("#rewardMessage");
const progressBar = document.querySelector("#progressBar");
const rewardMeta = document.querySelector("#rewardMeta");
const answerPanel = document.querySelector("#answerPanel");
const diagnosticStatus = document.querySelector("#diagnosticStatus");
const diagnosticLog = document.querySelector("#diagnosticLog");
const copyDiagnosticsButton = document.querySelector("#copyDiagnosticsButton");
const clearDiagnosticsButton = document.querySelector("#clearDiagnosticsButton");
const gptScript = document.querySelector('script[src*="securepubads.g.doubleclick.net/tag/js/gpt.js"]');

window.googletag = window.googletag || { cmd: [] };

const debugBuildId = "20260612-debug-2";

// Current ad unit path is filled from the provided GAM snippet.
// Note: the provided snippet was a standard display slot example.
// This page still uses a rewarded-ad flow, so the GAM ad unit itself
// must support rewarded ads on web for the unlock flow to work.
const rewardedConfig = {
  adUnitPath: "/21634903505/test20260",
  rewardAmount: 1,
  rewardType: "answer_unlock",
  developmentFallback: false,
  requestTimeoutMs: 8000,
};

const gamState = {
  servicesEnabled: false,
  logs: [],
  requestStartedAt: 0,
};

const failureMessageMap = {
  closed_before_reward: "使用者在獎勵發放前關閉了廣告，因此本次沒有解鎖答案。",
  no_fill: "目前沒有可投放的獎勵式廣告，可稍後再試。",
  unsupported_page: "這個頁面環境目前不支援 rewarded ad 格式。",
  show_failed: "廣告已載入，但這次未能成功顯示。",
  missing_configuration: "尚未填入正式 ad unit path，已改用開發模式模擬。",
  unavailable: "Google Ad Manager 物件尚未就緒。",
  timeout: "在等待 rewarded ad 回應時逾時，這通常是無 fill、設定不符，或該 ad unit 不是 rewarded inventory。",
};

const wait = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

function setProgress(value) {
  progressBar.style.width = `${value}%`;
}

function safeSerialize(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function appendDiagnostic(message) {
  const timestamp = new Date().toLocaleTimeString("zh-TW", {
    hour12: false,
  });
  gamState.logs.push(`[${timestamp}] ${message}`);
  diagnosticLog.textContent = gamState.logs.join("\n");
  diagnosticLog.scrollTop = diagnosticLog.scrollHeight;
}

function setDiagnosticStatus(message) {
  diagnosticStatus.textContent = message;
  appendDiagnostic(message);
}

function appendDiagnosticObject(label, object) {
  appendDiagnostic(`${label}: ${safeSerialize(object)}`);
}

function getEnvironmentSnapshot() {
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  return {
    href: window.location.href,
    debugBuildId,
    origin: window.location.origin,
    host: window.location.host,
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    isSecureContext: window.isSecureContext,
    referrer: document.referrer || "(empty)",
    visibilityState: document.visibilityState,
    hasFocus: document.hasFocus(),
    topEqualsSelf: window.top === window.self,
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    connection: connection
      ? {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        }
      : null,
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
    },
  };
}

function getGptSnapshot() {
  const pubadsService =
    window.googletag && typeof window.googletag.pubads === "function"
      ? window.googletag.pubads()
      : null;

  return {
    gptScriptPresent: Boolean(gptScript),
    gptApiReady: Boolean(window.googletag && window.googletag.apiReady),
    pubadsReady: Boolean(window.googletag && window.googletag.pubadsReady),
    cmdQueueAvailable: Boolean(window.googletag && window.googletag.cmd),
    defineOutOfPageSlotType:
      typeof (window.googletag && window.googletag.defineOutOfPageSlot),
    displayType: typeof (window.googletag && window.googletag.display),
    rewardedEnumAvailable: Boolean(
      window.googletag &&
        window.googletag.enums &&
        window.googletag.enums.OutOfPageFormat &&
        window.googletag.enums.OutOfPageFormat.REWARDED
    ),
    getVersion:
      window.googletag && typeof window.googletag.getVersion === "function"
        ? window.googletag.getVersion()
        : "(unavailable)",
    pubadsServiceAvailable: Boolean(pubadsService),
    serviceEnabledByPage: gamState.servicesEnabled,
  };
}

function logInitialDiagnostics() {
  appendDiagnostic(`Debug build id: ${debugBuildId}`);
  appendDiagnosticObject("環境摘要", getEnvironmentSnapshot());
  appendDiagnosticObject("GPT 初始狀態", getGptSnapshot());
}

function updateRewardStatus(message, progress, meta = "") {
  rewardPanel.classList.add("is-visible");
  rewardPanel.setAttribute("aria-hidden", "false");
  rewardMessage.textContent = message;
  setProgress(progress);
  rewardMeta.textContent = meta;
  appendDiagnostic(`${message}${meta ? ` | ${meta}` : ""}`);
}

function showAnswer() {
  answerPanel.classList.add("is-visible");
  answerPanel.setAttribute("aria-hidden", "false");
  unlockButton.textContent = "已解鎖答案";
  hintText.textContent = "答案已解鎖。若要換題，可直接修改頁面文案。";
  setDiagnosticStatus("rewarded ad 流程完成，答案已解鎖。");
}

function resetUnlockButton(label = "再試一次") {
  unlockButton.disabled = false;
  unlockButton.textContent = label;
}

function isPlaceholderPath(path) {
  return path.includes("REPLACE_WITH_YOUR_NETWORK_CODE");
}

function shouldUseDevelopmentFallback() {
  return (
    rewardedConfig.developmentFallback &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      isPlaceholderPath(rewardedConfig.adUnitPath))
  );
}

async function simulateRewardFlow() {
  answerPanel.classList.remove("is-visible");
  answerPanel.setAttribute("aria-hidden", "true");

  updateRewardStatus(
    "正在模擬獎勵式廣告載入...",
    18,
    "開發模式中：目前不會真的向 Google 請求廣告。"
  );
  await wait(900);

  updateRewardStatus("使用者已選擇觀看，模擬播放中...", 62);
  await wait(1400);

  updateRewardStatus("廣告流程完成，已解鎖答案。", 100);
  await wait(500);

  return { ok: true, simulated: true };
}

function ensureGamServicesEnabled() {
  if (gamState.servicesEnabled) {
    appendDiagnostic("Google Ad Manager services 之前已啟用，略過重複 enable。");
    return;
  }

  window.googletag.pubads().setTargeting("reward_amount", [
    String(rewardedConfig.rewardAmount),
  ]);
  window.googletag.pubads().setTargeting("reward_type", [
    rewardedConfig.rewardType,
  ]);
  window.googletag.pubads().enableSingleRequest();
  window.googletag.enableServices();
  gamState.servicesEnabled = true;
  setDiagnosticStatus("Google Ad Manager services 已啟用。");
  appendDiagnosticObject("GPT 啟用後狀態", getGptSnapshot());
}

function requestRewardedAd() {
  return new Promise((resolve) => {
    if (!window.googletag || !window.googletag.cmd) {
      setDiagnosticStatus("找不到 googletag.cmd，GPT 可能尚未載入。");
      resolve({ ok: false, reason: "unavailable" });
      return;
    }

    window.googletag.cmd.push(() => {
      appendDiagnosticObject("GPT cmd 執行時狀態", getGptSnapshot());

      if (!window.googletag.defineOutOfPageSlot) {
        setDiagnosticStatus("找不到 defineOutOfPageSlot，GPT API 不完整。");
        resolve({ ok: false, reason: "unavailable" });
        return;
      }

      ensureGamServicesEnabled();

      const slot = window.googletag.defineOutOfPageSlot(
        rewardedConfig.adUnitPath,
        window.googletag.enums.OutOfPageFormat.REWARDED
      );

      if (!slot) {
        setDiagnosticStatus(
          "defineOutOfPageSlot 回傳 null，通常代表這個頁面環境或 ad unit 不支援 rewarded ad。"
        );
        resolve({ ok: false, reason: "unsupported_page" });
        return;
      }

      let rewardGranted = false;
      let completed = false;
      let timeoutId = null;
      gamState.requestStartedAt = Date.now();

      slot.addService(window.googletag.pubads());
      setDiagnosticStatus(
        `rewarded slot 已建立，準備請求：${rewardedConfig.adUnitPath}`
      );
      appendDiagnosticObject("Slot 摘要", {
        adUnitPath:
          typeof slot.getAdUnitPath === "function"
            ? slot.getAdUnitPath()
            : rewardedConfig.adUnitPath,
        slotElementId:
          typeof slot.getSlotElementId === "function"
            ? slot.getSlotElementId()
            : "(unavailable)",
      });

      const finalize = (result) => {
        if (completed) {
          return;
        }

        completed = true;
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        const elapsedMs = Date.now() - gamState.requestStartedAt;
        window.googletag.destroySlots([slot]);
        appendDiagnosticObject("流程結束", {
          ...result,
          elapsedMs,
        });
        resolve(result);
      };

      timeoutId = window.setTimeout(() => {
        finalize({ ok: false, reason: "timeout" });
      }, rewardedConfig.requestTimeoutMs);

      window.googletag.pubads().addEventListener("slotRenderEnded", (event) => {
        if (event.slot !== slot || completed) {
          return;
        }

        appendDiagnosticObject("slotRenderEnded", {
          isEmpty: event.isEmpty,
          size: event.size,
          creativeId: event.creativeId,
          lineItemId: event.lineItemId,
          serviceName: event.serviceName,
          advertiserId: event.advertiserId,
          campaignId: event.campaignId,
          sourceAgnosticCreativeId: event.sourceAgnosticCreativeId,
          yieldGroupIds: event.yieldGroupIds,
        });

        if (event.isEmpty) {
          finalize({ ok: false, reason: "no_fill" });
          return;
        }

        updateRewardStatus(
          "廣告已載入，準備顯示...",
          36,
          "這一步代表 Google 已回傳可用廣告版位。"
        );
      });

      window.googletag
        .pubads()
        .addEventListener("rewardedSlotReady", (event) => {
          if (event.slot !== slot || completed) {
            return;
          }

          appendDiagnosticObject("rewardedSlotReady", {
            slotMatched: event.slot === slot,
            eventKeys: Object.keys(event),
          });
          updateRewardStatus(
            "獎勵式廣告已就緒，正在顯示...",
            58,
            "使用者已主動選擇觀看，符合 rewarded ad 的 opt-in 流程。"
          );

          const shown = event.makeRewardedVisible();
          appendDiagnostic(`makeRewardedVisible() => ${String(shown)}`);
          if (!shown) {
            finalize({ ok: false, reason: "show_failed" });
          }
        });

      window.googletag
        .pubads()
        .addEventListener("rewardedSlotGranted", (event) => {
          if (event.slot !== slot || completed) {
            return;
          }

          rewardGranted = true;
          appendDiagnosticObject("rewardedSlotGranted", {
            payload: event.payload || null,
            eventKeys: Object.keys(event),
          });
          updateRewardStatus(
            "廣告觀看完成，獎勵已發放。",
            100,
            "此時可以安全地解鎖答案內容。"
          );
        });

      window.googletag
        .pubads()
        .addEventListener("rewardedSlotClosed", (event) => {
          if (event.slot !== slot || completed) {
            return;
          }

          appendDiagnosticObject("rewardedSlotClosed", {
            slotMatched: event.slot === slot,
            rewardGranted,
          });
          if (rewardGranted) {
            finalize({ ok: true });
            return;
          }

          finalize({ ok: false, reason: "closed_before_reward" });
        });

      window.googletag.pubads().addEventListener("slotRequested", (event) => {
        if (event.slot !== slot || completed) {
          return;
        }

        appendDiagnosticObject("slotRequested", {
          slotMatched: event.slot === slot,
        });
      });

      window.googletag
        .pubads()
        .addEventListener("slotResponseReceived", (event) => {
          if (event.slot !== slot || completed) {
            return;
          }

          const responseInformation =
            typeof slot.getResponseInformation === "function"
              ? slot.getResponseInformation()
              : null;

          appendDiagnosticObject("slotResponseReceived", {
            responseInformation,
          });
        });

      window.googletag.pubads().addEventListener("slotOnload", (event) => {
        if (event.slot !== slot || completed) {
          return;
        }

        appendDiagnosticObject("slotOnload", {
          slotMatched: event.slot === slot,
        });
      });

      window.googletag
        .pubads()
        .addEventListener("impressionViewable", (event) => {
          if (event.slot !== slot || completed) {
            return;
          }

          appendDiagnosticObject("impressionViewable", {
            slotMatched: event.slot === slot,
          });
        });

      window.googletag
        .pubads()
        .addEventListener("slotVisibilityChanged", (event) => {
          if (event.slot !== slot || completed) {
            return;
          }

          appendDiagnosticObject("slotVisibilityChanged", {
            inViewPercentage: event.inViewPercentage,
          });
        });

      updateRewardStatus(
        "正在向 Google Ad Manager 請求獎勵式廣告...",
        14,
        `目前 ad unit path：${rewardedConfig.adUnitPath} | host=${window.location.hostname}`
      );
      window.googletag.display(slot);
      appendDiagnostic("已呼叫 googletag.display(slot)。");
    });
  });
}

if (gptScript) {
  gptScript.addEventListener("load", () => {
    setDiagnosticStatus("GPT script 已載入。");
    appendDiagnosticObject("GPT script load 後狀態", getGptSnapshot());
  });

  gptScript.addEventListener("error", () => {
    setDiagnosticStatus("GPT script 載入失敗。");
  });
}

window.addEventListener("error", (event) => {
  appendDiagnosticObject("window.error", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  appendDiagnosticObject("unhandledrejection", {
    reason:
      event.reason instanceof Error
        ? {
            name: event.reason.name,
            message: event.reason.message,
            stack: event.reason.stack,
          }
        : event.reason,
  });
});

document.addEventListener("visibilitychange", () => {
  appendDiagnostic(`visibilitychange: ${document.visibilityState}`);
});

window.addEventListener("pageshow", () => {
  appendDiagnostic("pageshow");
});

window.addEventListener("pagehide", () => {
  appendDiagnostic("pagehide");
});

setDiagnosticStatus(
  `頁面已載入。build=${debugBuildId} | host=${window.location.hostname} | adUnitPath=${rewardedConfig.adUnitPath}`
);
logInitialDiagnostics();

copyDiagnosticsButton.addEventListener("click", async () => {
  const text = diagnosticLog.textContent;

  try {
    await navigator.clipboard.writeText(text);
    setDiagnosticStatus("診斷 log 已複製到剪貼簿。");
  } catch (error) {
    appendDiagnosticObject("複製失敗", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

clearDiagnosticsButton.addEventListener("click", () => {
  gamState.logs = [];
  diagnosticLog.textContent = "";
  diagnosticStatus.textContent = "診斷 log 已清空。";
  appendDiagnostic("診斷 log 已清空。");
  logInitialDiagnostics();
});

unlockButton.addEventListener("click", async () => {
  unlockButton.disabled = true;
  unlockButton.textContent = "解鎖中...";
  hintText.textContent = "正在處理獎勵式廣告流程...";
  answerPanel.classList.remove("is-visible");
  answerPanel.setAttribute("aria-hidden", "true");
  setDiagnosticStatus("使用者已點擊按鈕，開始請求 rewarded ad。");
  appendDiagnosticObject("點擊當下環境摘要", getEnvironmentSnapshot());
  appendDiagnosticObject("點擊當下 GPT 狀態", getGptSnapshot());

  if (shouldUseDevelopmentFallback()) {
    if (isPlaceholderPath(rewardedConfig.adUnitPath)) {
      rewardMeta.textContent = failureMessageMap.missing_configuration;
    }

    await simulateRewardFlow();
    showAnswer();
    return;
  }

  const result = await requestRewardedAd();

  if (result.ok) {
    showAnswer();
    return;
  }

  updateRewardStatus(
    failureMessageMap[result.reason] || "這次沒有成功完成解鎖流程。",
    0,
    "若已填入正式 ad unit path，請確認網域、廣告版位與需求端設定都已生效。"
  );
  hintText.textContent = "這次沒有解鎖成功，你可以再試一次。";
  resetUnlockButton("再試一次");
});

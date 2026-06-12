const unlockButton = document.querySelector("#unlockButton");
const hintText = document.querySelector("#hintText");
const rewardPanel = document.querySelector("#rewardPanel");
const rewardMessage = document.querySelector("#rewardMessage");
const progressBar = document.querySelector("#progressBar");
const rewardMeta = document.querySelector("#rewardMeta");
const answerPanel = document.querySelector("#answerPanel");
const diagnosticStatus = document.querySelector("#diagnosticStatus");
const diagnosticLog = document.querySelector("#diagnosticLog");

window.googletag = window.googletag || { cmd: [] };

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

function appendDiagnostic(message) {
  const timestamp = new Date().toLocaleTimeString("zh-TW", {
    hour12: false,
  });
  gamState.logs.push(`[${timestamp}] ${message}`);
  diagnosticLog.textContent = gamState.logs.join("\n");
}

function setDiagnosticStatus(message) {
  diagnosticStatus.textContent = message;
  appendDiagnostic(message);
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
}

function requestRewardedAd() {
  return new Promise((resolve) => {
    if (!window.googletag || !window.googletag.cmd) {
      setDiagnosticStatus("找不到 googletag.cmd，GPT 可能尚未載入。");
      resolve({ ok: false, reason: "unavailable" });
      return;
    }

    window.googletag.cmd.push(() => {
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

      slot.addService(window.googletag.pubads());
      setDiagnosticStatus(
        `rewarded slot 已建立，準備請求：${rewardedConfig.adUnitPath}`
      );

      const finalize = (result) => {
        if (completed) {
          return;
        }

        completed = true;
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        window.googletag.destroySlots([slot]);
        appendDiagnostic(`流程結束：${JSON.stringify(result)}`);
        resolve(result);
      };

      timeoutId = window.setTimeout(() => {
        finalize({ ok: false, reason: "timeout" });
      }, rewardedConfig.requestTimeoutMs);

      window.googletag.pubads().addEventListener("slotRenderEnded", (event) => {
        if (event.slot !== slot || completed) {
          return;
        }

        appendDiagnostic(
          `slotRenderEnded: isEmpty=${String(event.isEmpty)} size=${JSON.stringify(
            event.size
          )}`
        );

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

          appendDiagnostic("收到 rewardedSlotReady 事件。");
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
          appendDiagnostic(
            `收到 rewardedSlotGranted：${JSON.stringify(event.payload || {})}`
          );
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

          appendDiagnostic("收到 rewardedSlotClosed。");
          if (rewardGranted) {
            finalize({ ok: true });
            return;
          }

          finalize({ ok: false, reason: "closed_before_reward" });
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

setDiagnosticStatus(
  `頁面已載入。host=${window.location.hostname} | adUnitPath=${rewardedConfig.adUnitPath}`
);

unlockButton.addEventListener("click", async () => {
  unlockButton.disabled = true;
  unlockButton.textContent = "解鎖中...";
  hintText.textContent = "正在處理獎勵式廣告流程...";
  answerPanel.classList.remove("is-visible");
  answerPanel.setAttribute("aria-hidden", "true");
  setDiagnosticStatus("使用者已點擊按鈕，開始請求 rewarded ad。");

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

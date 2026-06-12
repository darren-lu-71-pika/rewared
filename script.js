const unlockButton = document.querySelector("#unlockButton");
const hintText = document.querySelector("#hintText");
const rewardPanel = document.querySelector("#rewardPanel");
const rewardMessage = document.querySelector("#rewardMessage");
const progressBar = document.querySelector("#progressBar");
const rewardMeta = document.querySelector("#rewardMeta");
const answerPanel = document.querySelector("#answerPanel");

window.googletag = window.googletag || { cmd: [] };

// Current ad unit path is filled from the provided GAM snippet.
// Note: the provided snippet was a standard display slot example.
// This page still uses a rewarded-ad flow, so the GAM ad unit itself
// must support rewarded ads on web for the unlock flow to work.
const rewardedConfig = {
  adUnitPath: "/21634903505/test20260",
  rewardAmount: 1,
  rewardType: "answer unlock",
  developmentFallback: true,
};

const gamState = {
  servicesEnabled: false,
};

const failureMessageMap = {
  closed_before_reward: "使用者在獎勵發放前關閉了廣告，因此本次沒有解鎖答案。",
  no_fill: "目前沒有可投放的獎勵式廣告，可稍後再試。",
  unsupported_page: "這個頁面環境目前不支援 rewarded ad 格式。",
  show_failed: "廣告已載入，但這次未能成功顯示。",
  missing_configuration: "尚未填入正式 ad unit path，已改用開發模式模擬。",
  unavailable: "Google Ad Manager 物件尚未就緒，已改用開發模式模擬。",
};

const wait = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

function setProgress(value) {
  progressBar.style.width = `${value}%`;
}

function updateRewardStatus(message, progress, meta = "") {
  rewardPanel.classList.add("is-visible");
  rewardPanel.setAttribute("aria-hidden", "false");
  rewardMessage.textContent = message;
  setProgress(progress);
  rewardMeta.textContent = meta;
}

function showAnswer() {
  answerPanel.classList.add("is-visible");
  answerPanel.setAttribute("aria-hidden", "false");
  unlockButton.textContent = "已解鎖答案";
  hintText.textContent = "答案已解鎖。若要換題，可直接修改頁面文案。";
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
  window.googletag.enableServices();
  gamState.servicesEnabled = true;
}

function requestRewardedAd() {
  return new Promise((resolve) => {
    if (!window.googletag || !window.googletag.cmd) {
      resolve({ ok: false, reason: "unavailable" });
      return;
    }

    window.googletag.cmd.push(() => {
      if (!window.googletag.defineOutOfPageSlot) {
        resolve({ ok: false, reason: "unavailable" });
        return;
      }

      ensureGamServicesEnabled();

      const slot = window.googletag.defineOutOfPageSlot(
        rewardedConfig.adUnitPath,
        window.googletag.enums.OutOfPageFormat.REWARDED
      );

      if (!slot) {
        resolve({ ok: false, reason: "unsupported_page" });
        return;
      }

      let rewardGranted = false;
      let completed = false;

      slot.addService(window.googletag.pubads());

      const finalize = (result) => {
        if (completed) {
          return;
        }

        completed = true;
        window.googletag.destroySlots([slot]);
        resolve(result);
      };

      window.googletag.pubads().addEventListener("slotRenderEnded", (event) => {
        if (event.slot !== slot || completed) {
          return;
        }

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

          updateRewardStatus(
            "獎勵式廣告已就緒，正在顯示...",
            58,
            "使用者已主動選擇觀看，符合 rewarded ad 的 opt-in 流程。"
          );

          const shown = event.makeRewardedVisible();
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

          if (rewardGranted) {
            finalize({ ok: true });
            return;
          }

          finalize({ ok: false, reason: "closed_before_reward" });
        });

      updateRewardStatus(
        "正在向 Google Ad Manager 請求獎勵式廣告...",
        14,
        `目前 ad unit path：${rewardedConfig.adUnitPath}`
      );
      window.googletag.display(slot);
    });
  });
}

unlockButton.addEventListener("click", async () => {
  unlockButton.disabled = true;
  unlockButton.textContent = "解鎖中...";
  hintText.textContent = "正在處理獎勵式廣告流程...";
  answerPanel.classList.remove("is-visible");
  answerPanel.setAttribute("aria-hidden", "true");

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

(function () {
  function reportInput() {
    return document.getElementById("chatbot-input");
  }

  function comboInput() {
    return document.getElementById("ai-combo-input");
  }

  function runReportChat() {
    if (typeof sendReportChat === "function") sendReportChat();
  }

  function runComboChat() {
    if (typeof sendComboChat === "function") sendComboChat();
  }

  function installChatEventFix() {
    if (window.agriChatEventFixInstalled) return;
    window.agriChatEventFixInstalled = true;

    document.addEventListener("click", event => {
      const reportTrigger = event.target.closest?.("#chatbot-send, [data-question]");
      if (reportTrigger) {
        if (reportTrigger.dataset.question) reportInput().value = reportTrigger.dataset.question;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        runReportChat();
        return;
      }

      const comboTrigger = event.target.closest?.("#ai-combo-send, [data-ai-question]");
      if (comboTrigger) {
        if (comboTrigger.dataset.aiQuestion) comboInput().value = comboTrigger.dataset.aiQuestion;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        runComboChat();
      }
    }, true);

    document.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.target?.id === "chatbot-input") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        runReportChat();
      }
      if (event.target?.id === "ai-combo-input") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        runComboChat();
      }
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installChatEventFix);
  } else {
    installChatEventFix();
  }
}());

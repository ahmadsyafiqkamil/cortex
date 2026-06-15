document.addEventListener("DOMContentLoaded", () => {
  const wrapper = document.getElementById("diff-wrapper");
  if (!wrapper) return;

  const selectA = document.getElementById("diff-select-a");
  const selectB = document.getElementById("diff-select-b");
  const btn = document.getElementById("diff-btn");
  const output = document.getElementById("diff-output");
  const loading = document.getElementById("diff-loading");

  const aggregatorBase = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";

  btn.addEventListener("click", async () => {
    const a = selectA.value;
    const b = selectB.value;
    if (!a || !b) return;

    loading.classList.remove("hidden");
    output.innerHTML = "";
    btn.disabled = true;

    try {
      const [textA, textB] = await Promise.all([
        fetch(`${aggregatorBase}/${a}`).then(r => r.text()),
        fetch(`${aggregatorBase}/${b}`).then(r => r.text()),
      ]);

      const linesA = textA.split("\n");
      const linesB = textB.split("\n");
      const html = computeDiff(linesA, linesB, a, b);
      output.innerHTML = html;
    } catch (e) {
      output.innerHTML = `<p class="text-red-400 text-xs">Diff error: ${e.message}</p>`;
    } finally {
      loading.classList.add("hidden");
      btn.disabled = false;
    }
  });

  function computeDiff(linesA, linesB, labelA, labelB) {
    const lcs = buildLCS(linesA, linesB);
    const result = [];

    let i = 0, j = 0, k = 0;

    while (i < linesA.length || j < linesB.length) {
      if (k < lcs.length && i < linesA.length && j < linesB.length && linesA[i] === lcs[k] && linesB[j] === lcs[k]) {
        result.push({ type: "same", aNum: i + 1, bNum: j + 1, text: linesA[i] });
        i++; j++; k++;
      } else if (k < lcs.length && i < linesA.length && linesA[i] !== lcs[k]) {
        result.push({ type: "del", aNum: i + 1, bNum: null, text: linesA[i] });
        i++;
      } else if (k < lcs.length && j < linesB.length && linesB[j] !== lcs[k]) {
        result.push({ type: "add", aNum: null, bNum: j + 1, text: linesB[j] });
        j++;
      } else {
        if (i < linesA.length) {
          result.push({ type: "del", aNum: i + 1, bNum: null, text: linesA[i] });
          i++;
        }
        if (j < linesB.length) {
          result.push({ type: "add", aNum: null, bNum: j + 1, text: linesB[j] });
          j++;
        }
      }
    }

    let html = `<div class="mb-2 text-xs text-gray-500">`;
    html += `<span class="text-red-400">- ${labelA.slice(0, 16)}...</span> `;
    html += `<span class="text-emerald-400">+ ${labelB.slice(0, 16)}...</span>`;
    html += `</div>`;

    for (const line of result) {
      const cls = line.type === "add" ? "text-emerald-400" : line.type === "del" ? "text-red-400" : "text-gray-500";
      const prefix = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
      const aNum = line.aNum !== null ? line.aNum : "";
      const bNum = line.bNum !== null ? line.bNum : "";
      const num = line.type === "del" ? aNum : bNum;
      const escaped = line.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      html += `<div class="flex gap-2 text-xs ${cls}"><span class="w-6 text-right text-gray-700">${prefix}</span><span class="w-8 text-right text-gray-700">${num}</span><span>${escaped}</span></div>`;
    }

    return html;
  }

  function buildLCS(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    const result = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        result.unshift(a[i - 1]);
        i--; j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    return result;
  }
});

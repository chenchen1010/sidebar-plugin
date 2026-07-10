import React, { useEffect, useMemo, useState } from "react";
import { bitable, FieldType, IFieldMeta } from "@lark-base-open/js-sdk";
import { useTranslation } from "react-i18next";
import i18n from "./i18n";

type GroupedFiles = Record<string, File[]>;

type UploadCandidate = {
  folder: string;
  files: File[];
  recordId: string;
  uploadList: File[];
};

type BillingResult = {
  ok: boolean;
  balance?: number;
  idempotent?: boolean;
  credits_charged?: number;
  credits_price?: number;
  request_id?: string;
  code?: string;
  message?: string;
};

type SavedUploadSettings = {
  matchFieldId?: string;
  uploadFieldId?: string;
  maxImages?: number;
  priorityKeyword?: string;
};

// FileSystem API 类型声明
interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}

interface FileSystemFileEntry extends FileSystemEntry {
  file(successCallback: (file: File) => void, errorCallback?: (error: Error) => void): void;
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader(): FileSystemDirectoryReader;
}

interface FileSystemDirectoryReader {
  readEntries(
    successCallback: (entries: FileSystemEntry[]) => void,
    errorCallback?: (error: Error) => void,
  ): void;
}

// 扩展 DataTransferItem 以支持 webkitGetAsEntry
declare global {
  interface DataTransferItem {
    webkitGetAsEntry(): FileSystemEntry | null;
  }
}

const SUPPORTED_IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "bmp", "webp"];
const FIREFLY_CREDITS_PRICE = 10;
const FIREFLY_API_KEY_STORAGE = "firefly.batchImageUpload.apiKey";
const FIREFLY_SETTINGS_STORAGE = "firefly.batchImageUpload.settings";

const viteEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;
const FIREFLY_BILLING_ENDPOINT =
  viteEnv.VITE_FIREFLY_BILLING_ENDPOINT ||
  "https://firefly.qwjxqn.xyz/api/products/batch-image-upload/deduct";
const FIREFLY_HOME_URL =
  viteEnv.VITE_FIREFLY_HOME_URL ||
  "https://firefly.qwjxqn.xyz";
const FIREFLY_FEEDBACK_GROUP_URL =
  viteEnv.VITE_FIREFLY_FEEDBACK_GROUP_URL ||
  "https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=9d2vc5eb-0b13-46bc-8f52-c70b183e47a0";
const GUIDE_URL =
  viteEnv.VITE_BATCH_IMAGE_UPLOAD_GUIDE_URL ||
  "https://gcn6bvkburhk.feishu.cn/docx/GBSldiL5doEsq8xAqIJca6hFnqg?from=from_copylink";

const App: React.FC = () => {
  const { t } = useTranslation();
  const [table, setTable] = useState<any>(null);
  const [fieldMetaList, setFieldMetaList] = useState<IFieldMeta[]>([]);
  const [matchFieldId, setMatchFieldId] = useState<string>("");
  const [uploadFieldId, setUploadFieldId] = useState<string>("");
  const [maxImages, setMaxImages] = useState<number>(10);
  const [priorityKeyword, setPriorityKeyword] = useState<string>(() =>
    t("fields.priorityPlaceholder"),
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [initError, setInitError] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [rememberApiKey, setRememberApiKey] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [settingsHydrated, setSettingsHydrated] = useState<boolean>(false);

  useEffect(() => {
    document.title = t("app.title");
    document.documentElement.lang = i18n.resolvedLanguage || "zh";
  }, [t]);

  useEffect(() => {
    const forcedTheme = new URLSearchParams(window.location.search).get("theme");
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (theme?: string) => {
      const isDark = theme?.toUpperCase() === "DARK" || (!theme && media.matches);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
    };

    if (forcedTheme === "dark" || forcedTheme === "light") {
      applyTheme(forcedTheme.toUpperCase());
      return;
    }

    const bridge = bitable.bridge as any;
    let removeThemeListener: (() => void) | undefined;
    const handleMediaChange = () => applyTheme();

    if (typeof bridge?.getTheme === "function") {
      Promise.resolve(bridge.getTheme())
        .then((theme) => applyTheme(String(theme)))
        .catch(() => applyTheme());
    } else {
      applyTheme();
    }

    if (typeof bridge?.onThemeChange === "function") {
      removeThemeListener = bridge.onThemeChange((event: any) => {
        applyTheme(String(event?.data?.theme || ""));
      });
    } else {
      media.addEventListener("change", handleMediaChange);
    }

    return () => {
      removeThemeListener?.();
      media.removeEventListener("change", handleMediaChange);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const activeTable = await bitable.base.getActiveTable();
        const metaList = await activeTable.getFieldMetaList();
        setTable(activeTable);
        setFieldMetaList(metaList);
      } catch (err) {
        const message = (err as Error)?.message || t("log.initEnvError");
        setInitError(message);
        appendLog(t("log.initFailed", { message }));
      }
    };

    init();
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FIREFLY_API_KEY_STORAGE);
      if (saved) {
        setApiKey(saved);
        setRememberApiKey(true);
        setSettingsOpen(false);
      }
    } catch {
      // 浏览器禁用 localStorage 时保持默认不记住。
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FIREFLY_SETTINGS_STORAGE);
      if (raw) {
        const saved = JSON.parse(raw) as SavedUploadSettings;
        if (saved.matchFieldId) setMatchFieldId(saved.matchFieldId);
        if (saved.uploadFieldId) setUploadFieldId(saved.uploadFieldId);
        if (typeof saved.maxImages === "number" && saved.maxImages > 0) {
          setMaxImages(saved.maxImages);
        }
        if (typeof saved.priorityKeyword === "string") {
          setPriorityKeyword(saved.priorityKeyword);
        }
      }
    } catch {
      // 旧设置损坏时使用默认值，用户仍可重新设置。
    }
    setSettingsHydrated(true);
  }, []);

  useEffect(() => {
    try {
      if (rememberApiKey && apiKey.trim()) {
        window.localStorage.setItem(FIREFLY_API_KEY_STORAGE, apiKey.trim());
      } else {
        window.localStorage.removeItem(FIREFLY_API_KEY_STORAGE);
      }
    } catch {
      // 本地保存失败不影响上传流程。
    }
  }, [apiKey, rememberApiKey]);

  useEffect(() => {
    if (!settingsHydrated) return;
    try {
      if (!matchFieldId && !uploadFieldId) return;
      const settings: SavedUploadSettings = {
        matchFieldId,
        uploadFieldId,
        maxImages,
        priorityKeyword,
      };
      window.localStorage.setItem(FIREFLY_SETTINGS_STORAGE, JSON.stringify(settings));
    } catch {
      // 本地保存失败不影响当前上传。
    }
  }, [settingsHydrated, matchFieldId, uploadFieldId, maxImages, priorityKeyword]);

  useEffect(() => {
    if (!fieldMetaList.length) return;

    const hasMatchField = matchFieldId && fieldMetaList.some((field) => field.id === matchFieldId);
    const hasUploadField = uploadFieldId && fieldMetaList.some((field) => field.id === uploadFieldId);

    if (!hasMatchField) {
      const textField = fieldMetaList.find(
        (field) =>
          field.type === FieldType.Text || field.type === FieldType.Number,
      );
      if (textField) setMatchFieldId(textField.id);
    }

    if (!hasUploadField) {
      const attachmentField = fieldMetaList.find(
        (field) => field.type === FieldType.Attachment,
      );
      if (attachmentField) setUploadFieldId(attachmentField.id);
    }
  }, [fieldMetaList, matchFieldId, uploadFieldId]);

  const groupedFiles = useMemo<GroupedFiles>(() => {
    return groupFilesByFolder(selectedFiles);
  }, [selectedFiles]);

  const totalImages = useMemo(() => {
    return Object.values(groupedFiles).reduce(
      (sum, files) => sum + files.length,
      0,
    );
  }, [groupedFiles]);

  const appendLog = (message: string) => {
    setLogs((prev) => [message, ...prev].slice(0, 500));
  };

  const handleFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(isSupportedImage);
    setSelectedFiles(imageFiles);
    event.target.value = "";

    if (!files.length) {
      appendLog(t("log.noFiles"));
      return;
    }

    const skipped = files.length - imageFiles.length;
    appendLog(skipped > 0
      ? t("log.filesSelectedSkipped", { count: imageFiles.length, skipped })
      : t("log.filesSelected", { count: imageFiles.length }));
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    // 只有当离开整个 dropzone 时才设置为 false
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    appendLog(t("log.readingDropped"));

    try {
      const items = event.dataTransfer.items;
      if (!items || items.length === 0) {
        appendLog(t("log.noDroppedFiles"));
        return;
      }

      const files = await getAllFilesFromItems(items);
      const imageFiles = files.filter(isSupportedImage);
      setSelectedFiles(imageFiles);

      const skipped = files.length - imageFiles.length;
      appendLog(skipped > 0
        ? t("log.filesDroppedSkipped", { count: imageFiles.length, skipped })
        : t("log.filesDropped", { count: imageFiles.length }));
    } catch (err) {
      const message = (err as Error)?.message || t("common.unknownError");
      appendLog(t("log.readFolderFailed", { message }));
    }
  };

  const runUpload = async () => {
    if (!table) {
      appendLog(t("log.noTable"));
      return;
    }
    if (!matchFieldId || !uploadFieldId) {
      appendLog(t("log.selectFields"));
      return;
    }
    if (!selectedFiles.length) {
      appendLog(t("log.selectParent"));
      return;
    }
    if (!apiKey.trim()) {
      setSettingsOpen(true);
      appendLog(t("log.enterApiKey"));
      return;
    }

    setBusy(true);
    setLogs([]);

    try {
      appendLog(t("log.loadingRecords"));
      const recordIds: string[] = await table.getRecordIdList();
      const matchField = (await table.getField(matchFieldId)) as any;
      const uploadField = (await table.getField(uploadFieldId)) as any;

      const matchMap = new Map<string, string>();
      for (const recordId of recordIds) {
        const value = await matchField.getValue(recordId);
        const key = normalizeMatchValue(value);
        if (key) {
          matchMap.set(key, recordId);
        }
      }

      appendLog(t("log.recordsLoaded", {
        records: recordIds.length,
        keys: matchMap.size,
      }));

      const groups = Object.entries(groupedFiles);
      if (!groups.length) {
        appendLog(t("log.noSubfolders"));
        return;
      }

      const folderKeys = groups.map(([folder]) => {
        const key = normalizeFolderName(folder);
        return `${jsonify(key)} len=${key.length}`;
      });
      const matchKeys = [...matchMap.keys()].map((k) => `${jsonify(k)} len=${k.length}`);

      appendLog(t("log.subfoldersDebug", { count: groups.length, values: folderKeys.join(" | ") }));
      appendLog(t("log.matchKeysDebug", { count: matchKeys.length, values: matchKeys.join(" | ") }));

      const limit = Math.max(1, maxImages || 0);
      const candidates: UploadCandidate[] = [];
      let skipped = 0;

      for (const [folder, files] of groups) {
        const folderKey = normalizeFolderName(folder);
        const recordId = matchMap.get(folderKey);
        if (!recordId) {
          appendLog(t("log.noMatch", {
            key: jsonify(folderKey),
            length: folderKey.length,
          }));
          skipped += 1;
          continue;
        }

        const ordered = orderFiles(files, priorityKeyword);
        const uploadList = ordered.slice(0, limit);
        if (!uploadList.length) {
          appendLog(t("log.noImagesInFolder", { folder }));
          skipped += 1;
          continue;
        }

        candidates.push({
          folder,
          files,
          recordId,
          uploadList,
        });
      }

      if (!candidates.length) {
        appendLog(t("log.noCandidates"));
        return;
      }

      appendLog(t("log.billingStart", {
        records: candidates.length,
        price: FIREFLY_CREDITS_PRICE,
      }));
      const billing = await chargeFireflyUpload(apiKey.trim(), {
        folderCount: groups.length,
        imageCount: totalImages,
        recordCount: candidates.length,
      });
      appendLog(billing.idempotent
        ? t("log.billingIdempotent", { balance: formatBalance(billing.balance) })
        : t("log.billingSuccess", {
          charged: billing.credits_charged ?? FIREFLY_CREDITS_PRICE,
          balance: formatBalance(billing.balance),
        }));

      let success = 0;
      let failed = 0;

      for (const { folder, files, recordId, uploadList } of candidates) {
        appendLog(t("log.processingFolder", { folder }));

        if (files.length > limit) {
          appendLog(t("log.overLimit", { count: files.length, limit }));
        }

        appendLog(t("log.uploadOrder", {
          count: uploadList.length,
          files: uploadList.map((file) => file.name).join(" , "),
        }));

        try {
          await uploadField.setValue(recordId, uploadList);
          appendLog(t("log.recordUpdated", { recordId, count: uploadList.length }));
          success += 1;
        } catch (err) {
          const message = (err as Error)?.message || t("common.unknownError");
          appendLog(t("log.uploadFailed", { message }));
          failed += 1;
        }
      }

      appendLog(t("log.complete", { success, failed, skipped }));
    } catch (err) {
      const message = (err as Error)?.message || t("common.unknownError");
      appendLog(t("log.runFailed", { message }));
    } finally {
      setBusy(false);
    }
  };

  const folderPreview = useMemo(() => {
    return Object.entries(groupedFiles).map(([folder, files]) => {
      const ordered = orderFiles(files, priorityKeyword);
      return {
        folder,
        total: files.length,
        preview: ordered.slice(0, 3).map((file) => file.name),
      };
    });
  }, [groupedFiles, priorityKeyword]);

  const settingsReady = Boolean(apiKey.trim());

  const finishSettings = () => {
    if (!settingsReady) {
      appendLog(t("log.enterApiKey"));
      return;
    }
    setSettingsOpen(false);
  };

  return (
    <div className="app">
      <header className="banner-card">
        <div className="banner-title-row">
          <h1 className="banner-title">{t("app.title")}</h1>
          <a className="banner-guide" href={GUIDE_URL} target="_blank" rel="noreferrer">
            {t("app.guide")}
          </a>
        </div>
        <div className="banner-tags">
          <span className="banner-tag">{t("app.matchTag")}</span>
          <span className="banner-tag billing-note">
            {t("app.billingTag", { price: FIREFLY_CREDITS_PRICE })}
          </span>
        </div>
        <div className="banner-footer">
          <a className="banner-link" href={FIREFLY_HOME_URL} target="_blank" rel="noreferrer">
            {t("app.fireflyCta")}
          </a>
          <a className="banner-link" href={FIREFLY_FEEDBACK_GROUP_URL} target="_blank" rel="noreferrer">
            <span aria-hidden="true">💬</span>
            <span>{t("app.contact")}</span>
          </a>
        </div>
      </header>

      {initError && <div className="alert error">{t("log.initFailed", { message: initError })}</div>}

      <section className="panel workspace-panel">
        <div className="panel-head">
          <div>
            <h2>{t("workspace.title")}</h2>
            <p>{t("workspace.subtitle")}</p>
          </div>
          <button
            className={`icon-btn ${settingsOpen ? "active" : ""}`}
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label={t(settingsOpen ? "workspace.collapseSettings" : "workspace.expandSettings")}
            title={t(settingsOpen ? "workspace.collapseSettings" : "workspace.expandSettings")}
          >
            ⚙
          </button>
        </div>

        {settingsOpen ? (
          <div className="settings-block">
            <div className="field account-key">
              <label>{t("settings.apiKeyLabel")}</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t("settings.apiKeyPlaceholder")}
                autoComplete="off"
              />
              <p className="hint">{t("settings.apiKeyHint")}</p>
            </div>

            <div className="billing-actions">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={rememberApiKey}
                  onChange={(e) => setRememberApiKey(e.target.checked)}
                />
                <span>{t("settings.remember")}</span>
              </label>
              <button className="btn secondary compact" type="button" onClick={finishSettings}>
                {t("settings.done")}
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid upload-settings-grid">
          <div className="field">
            <label>{t("fields.matchLabel")}</label>
            <select
              value={matchFieldId}
              onChange={(e) => setMatchFieldId(e.target.value)}
            >
              <option value="">{t("fields.select")}</option>
              {fieldMetaList.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name} · {formatFieldType(field.type)}
                </option>
              ))}
            </select>
            <p className="hint">{t("fields.matchHint")}</p>
          </div>

          <div className="field">
            <label>{t("fields.uploadLabel")}</label>
            <select
              value={uploadFieldId}
              onChange={(e) => setUploadFieldId(e.target.value)}
            >
              <option value="">{t("fields.select")}</option>
              {fieldMetaList.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name} · {formatFieldType(field.type)}
                </option>
              ))}
            </select>
            <p className="hint">{t("fields.uploadHint")}</p>
          </div>

          <div className="field">
            <label>{t("fields.limitLabel")}</label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxImages}
              onChange={(e) => setMaxImages(Number(e.target.value) || 1)}
            />
            <p className="hint">{t("fields.limitHint")}</p>
          </div>

          <div className="field">
            <label>{t("fields.priorityLabel")}</label>
            <input
              type="text"
              value={priorityKeyword}
              onChange={(e) => setPriorityKeyword(e.target.value)}
              placeholder={t("fields.priorityPlaceholder")}
            />
            <p className="hint">{t("fields.priorityHint")}</p>
          </div>
        </div>

        <div
          className={`dropzone ${isDragging ? "dragging" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="drop-content">
            <p className="eyebrow">{t("dropzone.eyebrow")}</p>
            <p className="sub">{t("dropzone.description")}</p>
            <label className="btn">
              {t("dropzone.button")}
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFolderChange}
                {...({ webkitdirectory: "true" } as any)}
              />
            </label>
          </div>
        </div>

        <div className="summary">
          <div>{t("summary.folders", { count: folderPreview.length })}</div>
          <div>{t("summary.images", { count: totalImages })}</div>
          <div>{t("summary.limit", { count: maxImages })}</div>
          <div>{t("summary.sort")}</div>
        </div>

        {folderPreview.length > 0 && (
          <div className="folder-list">
            {folderPreview.map((item) => (
              <div key={item.folder} className="folder-card">
                <div className="folder-title">{item.folder}</div>
                <div className="folder-meta">{t("summary.folderMeta", {
                  count: item.total,
                  preview: item.preview.length ? item.preview.join(", ") : t("common.none"),
                })}</div>
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button className="btn primary" onClick={runUpload} disabled={busy}>
            {t(busy ? "actions.uploading" : "actions.start")}
          </button>
          <button
            className="btn ghost"
            onClick={() => setLogs([])}
            disabled={busy}
          >
            {t("actions.clearLogs")}
          </button>
        </div>
      </section>

      <section className="panel logs">
        <div className="panel-head">
          <h2>{t("logsPanel.title")}</h2>
          <p>{t("logsPanel.subtitle")}</p>
        </div>

        <div className="log-box">
          {logs.length === 0 && <div className="hint muted">{t("logsPanel.empty")}</div>}
          {logs.map((line, index) => (
            <div key={`${line}-${index}`} className="log-line">
              {line}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default App;

class BillingError extends Error {
  code?: string;
  balance?: number;

  constructor(message: string, code?: string, balance?: number) {
    super(message);
    this.name = "BillingError";
    this.code = code;
    this.balance = balance;
  }
}

async function chargeFireflyUpload(
  apiKey: string,
  meta: { folderCount: number; imageCount: number; recordCount: number },
): Promise<BillingResult> {
  const requestId = createRequestId();
  let response: Response;

  try {
    response = await fetch(FIREFLY_BILLING_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        request_id: requestId,
        folder_count: meta.folderCount,
        image_count: meta.imageCount,
        record_count: meta.recordCount,
      }),
    });
  } catch (error) {
    throw new BillingError(
      i18n.t("billing.connectionError", {
        endpoint: billingEndpointLabel(),
        reason: (error as Error)?.message || i18n.t("billing.networkReason"),
      }),
      "NETWORK_ERROR",
    );
  }

  const payload = await readJson<BillingResult>(response);
  if (!response.ok || !payload?.ok) {
    const code = payload?.code || `HTTP_${response.status}`;
    const message = payload?.message || billingMessage(code);
    throw new BillingError(message, code, payload?.balance);
  }

  return payload;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function billingEndpointLabel(): string {
  try {
    return new URL(FIREFLY_BILLING_ENDPOINT).host;
  } catch {
    return FIREFLY_BILLING_ENDPOINT;
  }
}

function billingMessage(code: string): string {
  const key = `billing.errors.${code}`;
  return i18n.exists(key) ? i18n.t(key) : i18n.t("billing.errors.fallback");
}

function createRequestId(): string {
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function formatBalance(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return i18n.t("billing.balancePending");
  }
  return i18n.t("billing.balance", { value });
}

function groupFilesByFolder(files: File[]): GroupedFiles {
  const grouped: GroupedFiles = {};
  if (!files.length) return grouped;

  const firstPath = getRelativePath(files[0]);
  const root = firstPath.split(/[\\/]/)[0];

  files.forEach((file) => {
    const relative = getRelativePath(file);
    const parts = relative.split(/[\\/]/).filter(Boolean);
    if (!parts.length) return;

    const withoutRoot = parts[0] === root ? parts.slice(1) : parts;
    if (withoutRoot.length < 2) {
      // 文件不在子文件夹内，跳过
      return;
    }

    const folder = withoutRoot[0];
    grouped[folder] = grouped[folder] || [];
    grouped[folder].push(file);
  });
  return grouped;
}

function getRelativePath(file: File): string {
  const path = (file as any).webkitRelativePath || file.name || "";
  return path.startsWith("/") ? path.slice(1) : path;
}

function isSupportedImage(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return SUPPORTED_IMAGE_EXTS.includes(ext);
}

function normalizeMatchValue(value: unknown, depth = 0): string {
  if (depth > 3) return "";
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return normalizeWhitespace(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeMatchValue(item, depth + 1))
      .filter(Boolean)
      .join(",");
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, any>;
    if (typeof obj.text === "string") return normalizeWhitespace(obj.text);
    if (Array.isArray(obj.text_arr)) {
      return obj.text_arr
        .map((t) => normalizeMatchValue(t, depth + 1))
        .filter(Boolean)
        .join(",");
    }
    if (typeof obj.name === "string") return normalizeWhitespace(obj.name);
    if (typeof obj.display === "string") return normalizeWhitespace(obj.display);
    if (typeof obj.value === "string") return normalizeWhitespace(obj.value);
  }
  return normalizeWhitespace(String(value));
}

function normalizeFolderName(folder: string): string {
  const base = normalizeWhitespace(folder);
  // Remove common duplicate suffixes added by desktop file managers.
  const cleaned = base
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s*-\s*(副本|copy|コピー)\s*$/i, "");
  return normalizeMatchValue(cleaned);
}

function describeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
}

function jsonify(input: string): string {
  return JSON.stringify(input);
}

function orderFiles(files: File[], priorityKeyword: string): File[] {
  const cover: File[] = [];
  const numbered: { value: number; file: File }[] = [];
  const others: File[] = [];

  files.forEach((file) => {
    const name = file.name;
    const base = name.replace(/\.[^.]+$/, "");

    if (priorityKeyword && name.includes(priorityKeyword)) {
      cover.push(file);
      return;
    }

    const nums = base.match(/\d+/g);
    if (nums && nums.length) {
      const lastNum = parseInt(nums[nums.length - 1], 10);
      if (!Number.isNaN(lastNum)) {
        numbered.push({ value: lastNum, file });
        return;
      }
    }

    others.push(file);
  });

  cover.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  numbered.sort((a, b) => a.value - b.value || a.file.name.localeCompare(b.file.name, "zh-CN"));
  others.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  return [
    ...cover,
    ...numbered.map((item) => item.file),
    ...others,
  ];
}

function formatFieldType(type: FieldType): string {
  const mapping: Record<number, string> = {
    [FieldType.Text]: "fieldType.text",
    [FieldType.Number]: "fieldType.number",
    [FieldType.Attachment]: "fieldType.attachment",
  };
  return mapping[type]
    ? i18n.t(mapping[type])
    : i18n.t("fieldType.unknown", { type });
}

async function getAllFilesFromItems(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = [];
  const entries: FileSystemEntry[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entry = item.webkitGetAsEntry();
    if (entry) {
      entries.push(entry);
    }
  }

  for (const entry of entries) {
    await traverseFileTree(entry, "", files);
  }

  return files;
}

async function traverseFileTree(
  entry: FileSystemEntry,
  path: string,
  files: File[],
): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });

    // 手动设置 webkitRelativePath
    const fullPath = path ? `${path}/${file.name}` : file.name;
    Object.defineProperty(file, "webkitRelativePath", {
      value: fullPath,
      writable: false,
    });

    files.push(file);
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

    const newPath = path ? `${path}/${entry.name}` : entry.name;
    for (const childEntry of entries) {
      await traverseFileTree(childEntry, newPath, files);
    }
  }
}

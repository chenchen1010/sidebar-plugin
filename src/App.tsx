import React, { useEffect, useMemo, useState } from "react";
import { bitable, FieldType, IFieldMeta } from "@lark-base-open/js-sdk";

type GroupedFiles = Record<string, File[]>;

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

const App: React.FC = () => {
  const [table, setTable] = useState<any>(null);
  const [fieldMetaList, setFieldMetaList] = useState<IFieldMeta[]>([]);
  const [matchFieldId, setMatchFieldId] = useState<string>("");
  const [uploadFieldId, setUploadFieldId] = useState<string>("");
  const [maxImages, setMaxImages] = useState<number>(10);
  const [priorityKeyword, setPriorityKeyword] = useState<string>("封面");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [initError, setInitError] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      try {
        const activeTable = await bitable.base.getActiveTable();
        const metaList = await activeTable.getFieldMetaList();
        setTable(activeTable);
        setFieldMetaList(metaList);
      } catch (err) {
        const message = (err as Error)?.message || "无法获取多维表格环境";
        setInitError(message);
        appendLog(`❌ 初始化失败：${message}`);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!fieldMetaList.length) return;

    if (!matchFieldId) {
      const textField = fieldMetaList.find(
        (field) =>
          field.type === FieldType.Text || field.type === FieldType.Number,
      );
      if (textField) setMatchFieldId(textField.id);
    }

    if (!uploadFieldId) {
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
      appendLog("⚠️ 未选择任何文件");
      return;
    }

    const skipped = files.length - imageFiles.length;
    appendLog(
      `📂 已选中 ${imageFiles.length} 个图片文件${skipped > 0 ? `，忽略 ${skipped} 个非图片文件` : ""}`,
    );
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
    appendLog("📂 正在读取拖入的文件夹...");

    try {
      const items = event.dataTransfer.items;
      if (!items || items.length === 0) {
        appendLog("⚠️ 未检测到拖入的文件");
        return;
      }

      const files = await getAllFilesFromItems(items);
      const imageFiles = files.filter(isSupportedImage);
      setSelectedFiles(imageFiles);

      const skipped = files.length - imageFiles.length;
      appendLog(
        `📂 拖入 ${imageFiles.length} 个图片文件${skipped > 0 ? `，忽略 ${skipped} 个非图片文件` : ""}`,
      );
    } catch (err) {
      const message = (err as Error)?.message || "未知错误";
      appendLog(`❌ 读取文件夹失败：${message}`);
    }
  };

  const runUpload = async () => {
    if (!table) {
      appendLog("❌ 未获取到多维表格实例，刷新插件或重新打开试试");
      return;
    }
    if (!matchFieldId || !uploadFieldId) {
      appendLog("⚠️ 请选择匹配字段和上传字段");
      return;
    }
    if (!selectedFiles.length) {
      appendLog("⚠️ 请先选择包含子文件夹的图片目录");
      return;
    }

    setBusy(true);
    setLogs([]);

    try {
      appendLog("🚀 获取记录列表...");
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
        appendLog(
          `🧭 记录 ${recordId} 字段值 -> ${jsonify(key)} | 原始: ${describeValue(value)}`,
        );
      }

      appendLog(
        `✅ 已获取 ${recordIds.length} 条记录，可用于匹配的键 ${matchMap.size} 个`,
      );

      const groups = Object.entries(groupedFiles);
      if (!groups.length) {
        appendLog("⚠️ 未检测到子文件夹，请确认选择的是父目录");
        return;
      }

      const folderKeys = groups.map(([folder]) => {
        const key = normalizeFolderName(folder);
        return `${jsonify(key)} len=${key.length}`;
      });
      const matchKeys = [...matchMap.keys()].map((k) => `${jsonify(k)} len=${k.length}`);

      appendLog(`📂 子文件夹(${groups.length})：${folderKeys.join(" | ")}`);
      appendLog(`🔑 匹配字段键(${matchKeys.length})：${matchKeys.join(" | ")}`);

      let success = 0;
      let failed = 0;
      let skipped = 0;
      const limit = Math.max(1, maxImages || 0);

      for (const [folder, files] of groups) {
        appendLog(`📂 处理子文件夹：${folder}`);

        const folderKey = normalizeFolderName(folder);
        const recordId = matchMap.get(folderKey);
        if (!recordId) {
          appendLog(
            `⚠️ 找不到匹配的记录，跳过（子文件夹键: ${jsonify(folderKey)} len=${folderKey.length}；可用: ${[...matchMap.keys()].map(jsonify).join(" , ")})`,
          );
          skipped += 1;
          continue;
        }

        const ordered = orderFiles(files, priorityKeyword);
        const uploadList = ordered.slice(0, limit);

        if (!uploadList.length) {
          appendLog("⚠️ 子文件夹中没有符合条件的图片，跳过");
          skipped += 1;
          continue;
        }

        if (files.length > limit) {
          appendLog(
            `⚠️ 子文件夹共有 ${files.length} 张，超过上限 ${limit}，仅取前 ${limit} 张`,
          );
        }

        appendLog(
          `🧮 上传顺序（${uploadList.length} 张）：${uploadList
            .map((f) => f.name)
            .join(" , ")}`,
        );

        try {
          await uploadField.setValue(recordId, uploadList);
          appendLog(
            `✅ 已更新记录 ${recordId}，上传 ${uploadList.length} 张图片`,
          );
          success += 1;
        } catch (err) {
          const message = (err as Error)?.message || "未知错误";
          appendLog(`❌ 上传失败：${message}`);
          failed += 1;
        }
      }

      appendLog(
        `🎉 完成：成功 ${success} 个，失败 ${failed} 个，跳过 ${skipped} 个`,
      );
    } catch (err) {
      const message = (err as Error)?.message || "未知错误";
      appendLog(`❌ 运行出错：${message}`);
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

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Folder Image Sync</p>
          <h1>图片批量上传</h1>
          <p className="sub">
            选择父目录 → 按子文件夹名匹配记录 → 将图片写入附件字段
          </p>
        </div>
        <div className="badge">智能匹配 · 关键词优先 · 数字升序 </div>
      </header>

      {initError && <div className="alert error">初始化失败：{initError}</div>}

      <section className="panel">
        <div className="panel-head">
          <h2>字段映射</h2>
          <p>用子文件夹名称匹配记录，再写入图片字段</p>
        </div>

        <div className="grid">
          <div className="field">
            <label>匹配字段（行定位）</label>
            <select
              value={matchFieldId}
              onChange={(e) => setMatchFieldId(e.target.value)}
            >
              <option value="">选择字段</option>
              {fieldMetaList.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name} · {formatFieldType(field.type)}
                </option>
              ))}
            </select>
            <p className="hint">子文件夹名称需与该字段值完全一致</p>
          </div>

          <div className="field">
            <label>上传字段（图片/附件）</label>
            <select
              value={uploadFieldId}
              onChange={(e) => setUploadFieldId(e.target.value)}
            >
              <option value="">选择字段</option>
              {fieldMetaList.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name} · {formatFieldType(field.type)}
                </option>
              ))}
            </select>
            <p className="hint">将按照封面优先、数字顺序写入</p>
          </div>

          <div className="field">
            <label>每行最多上传</label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxImages}
              onChange={(e) => setMaxImages(Number(e.target.value) || 1)}
            />
            <p className="hint">超出数量会被自动截断</p>
          </div>

          <div className="field">
            <label>优先关键词（封面）</label>
            <input
              type="text"
              value={priorityKeyword}
              onChange={(e) => setPriorityKeyword(e.target.value)}
              placeholder="封面"
            />
            <p className="hint">文件名包含此关键词将优先上传</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>选择父目录</h2>
          <p>使用「选择文件夹」或直接拖拽文件夹进来</p>
        </div>

        <div
          className={`dropzone ${isDragging ? "dragging" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="drop-content">
            <p className="eyebrow">拖拽文件夹到这里</p>
            <p className="sub">
              仅处理子文件夹内的图片，支持 {SUPPORTED_IMAGE_EXTS.join(", ")}
            </p>
            <label className="btn">
              选择文件夹
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
          <div>子文件夹：{folderPreview.length}</div>
          <div>图片总数：{totalImages}</div>
          <div>单行上限：{maxImages}</div>
          <div>规则：封面优先 &gt; 数字升序 &gt; 其他</div>
        </div>

        {folderPreview.length > 0 && (
          <div className="folder-list">
            {folderPreview.map((item) => (
              <div key={item.folder} className="folder-card">
                <div className="folder-title">{item.folder}</div>
                <div className="folder-meta">
                  {item.total} 张 · 预览{" "}
                  {item.preview.length ? item.preview.join(", ") : "无"}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button className="btn primary" onClick={runUpload} disabled={busy}>
            {busy ? "正在上传..." : "开始上传"}
          </button>
          <button
            className="btn ghost"
            onClick={() => setLogs([])}
            disabled={busy}
          >
            清空日志
          </button>
        </div>
      </section>

      <section className="panel logs">
        <div className="panel-head">
          <h2>运行日志</h2>
          <p>实时查看处理进度</p>
        </div>
        <div className="log-box">
          {logs.length === 0 && <div className="hint muted">暂无日志</div>}
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
  // 去掉常见复制后缀，如 " (1)"、"(1)"、" - 副本"
  const cleaned = base.replace(/\s*\(\d+\)\s*$/, "").replace(/\s*-\s*副本$/, "");
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

function orderFiles(files: File[], priorityKeyword: string = "封面"): File[] {
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
    [FieldType.Text]: "文本",
    [FieldType.Number]: "数字",
    [FieldType.Attachment]: "附件/图片",
  };
  return mapping[type] || `类型 ${type}`;
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

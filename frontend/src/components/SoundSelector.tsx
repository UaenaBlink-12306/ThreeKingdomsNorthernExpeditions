import { useState, useRef } from "react";
import { saveSelectedSound, getSelectedSound, playMechanicalClick } from "../utils/sound";

interface SoundSelectorProps {
  onClose: () => void;
}

export default function SoundSelector({ onClose }: SoundSelectorProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(getSelectedSound());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 预设音效选项
  const presetSounds = [
    { name: "默认生成音效（程序生成）", url: null },
  ];

  function handleSelectPreset(url: string | null) {
    setSelectedUrl(url);
    if (url) {
      setPreviewUrl(url);
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSelectedUrl(url);
      setPreviewUrl(url);
    }
  }

  function handlePreview() {
    if (previewUrl) {
      const audio = new Audio(previewUrl);
      audio.volume = 0.6;
      audio.play().catch(console.error);
    } else {
      // 预览默认生成音效
      playMechanicalClick();
    }
  }

  function handleSave() {
    if (selectedUrl !== null) {
      saveSelectedSound(selectedUrl);
    } else {
      // 清除选择，使用默认生成音效
      localStorage.removeItem("zhuge_selected_sound");
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>选择按钮音效</h2>
        <p style={{ marginBottom: "16px", fontSize: "14px", color: "#5c3e26" }}>
          选择一个音效文件，或上传你自己的音效文件（支持 MP3、WAV、OGG 格式）
        </p>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
            选择音效：
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
            {presetSounds.map((preset, index) => (
              <label
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px",
                  background: selectedUrl === preset.url ? "#f0e6d2" : "#faf8f2",
                  border: "1px solid #a68b6b",
                  borderRadius: "2px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="sound-preset"
                  checked={selectedUrl === preset.url}
                  onChange={() => handleSelectPreset(preset.url)}
                />
                <span>{preset.name}</span>
              </label>
            ))}
          </div>
          
          <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
            或上传自定义音效文件：
          </label>
          <p style={{ fontSize: "12px", color: "#5c3e26", marginBottom: "8px" }}>
            支持 MP3、WAV、OGG 格式。推荐使用短促的点击音效（0.1-0.3秒）
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ width: "100%" }}
          >
            选择音效文件
          </button>
          {selectedUrl && selectedUrl.startsWith("blob:") && (
            <p style={{ marginTop: "8px", fontSize: "12px", color: "#5c3e26" }}>
              已选择文件
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button type="button" onClick={handlePreview} style={{ flex: 1 }}>
            预览音效
          </button>
          <button type="button" onClick={onClose} style={{ flex: 1 }}>
            取消
          </button>
        </div>

        <button type="button" onClick={handleSave} className="primary-cta" style={{ width: "100%" }}>
          保存并应用
        </button>
      </div>
    </div>
  );
}

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
      <div className="modal sound-selector" onClick={(e) => e.stopPropagation()}>
        <h2>选择按钮音效</h2>
        <p className="sound-selector-intro">
          选择一个音效文件，或上传你自己的音效文件（支持 MP3、WAV、OGG 格式）
        </p>

        <div className="sound-selector-section">
          <label className="sound-selector-label">
            选择音效：
          </label>
          <div className="sound-selector-preset-list">
            {presetSounds.map((preset, index) => (
              <label
                key={index}
                className={`sound-selector-option ${
                  selectedUrl === preset.url ? "sound-selector-option-active" : ""
                }`}
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
          
          <label className="sound-selector-label">
            或上传自定义音效文件：
          </label>
          <p className="sound-selector-upload-tip">
            支持 MP3、WAV、OGG 格式。推荐使用短促的点击音效（0.1-0.3秒）
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="sound-selector-file-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="sound-selector-action-btn"
          >
            选择音效文件
          </button>
          {selectedUrl && selectedUrl.startsWith("blob:") && (
            <p className="sound-selector-file-note">
              已选择文件
            </p>
          )}
        </div>

        <div className="sound-selector-actions">
          <button type="button" onClick={handlePreview} className="sound-selector-action-btn">
            预览音效
          </button>
          <button type="button" onClick={onClose} className="sound-selector-action-btn">
            取消
          </button>
        </div>

        <button type="button" onClick={handleSave} className="primary-cta sound-selector-save-btn">
          保存并应用
        </button>
      </div>
    </div>
  );
}

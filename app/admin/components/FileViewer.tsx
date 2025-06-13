"use client";

import React from 'react';

interface FileViewerProps {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  className?: string;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  fileUrl,
  fileName,
  mimeType,
  className = ""
}) => {
  const renderFileContent = () => {
    if (!fileUrl) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📄</div>
            <p>File preview not available</p>
          </div>
        </div>
      );
    }

    // PDF files
    if (mimeType?.includes('pdf')) {
      return (
        <iframe
          src={fileUrl}
          className="w-full h-full border-0"
          title={fileName}
        />
      );
    }

    // Excel files - show download link since Excel can't be embedded
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel') || fileName?.endsWith('.xlsx') || fileName?.endsWith('.xls')) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-600">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium mb-2">{fileName}</h3>
          <p className="text-sm text-gray-500 mb-4">Excel файлы не могут быть отображены напрямую</p>
          <a
            href={fileUrl}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md inline-flex items-center space-x-2"
          >
            <span>📥</span>
            <span>Скачать и открыть</span>
          </a>
          <div className="mt-4 text-xs text-gray-400">
            <p>Совет: откройте файл в Excel рядом с этим окном</p>
            <p>для сравнения с распознанными данными</p>
          </div>
        </div>
      );
    }

    // Images
    if (mimeType?.includes('image')) {
      return (
        <img
          src={fileUrl}
          alt={fileName}
          className="max-w-full max-h-full object-contain"
        />
      );
    }

    // CSV and text files
    if (mimeType?.includes('text') || mimeType?.includes('csv')) {
      return (
        <iframe
          src={fileUrl}
          className="w-full h-full border-0"
          title={fileName}
        />
      );
    }

    // Generic fallback
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600">
        <div className="text-6xl mb-4">📄</div>
        <h3 className="text-lg font-medium mb-2">{fileName}</h3>
        <p className="text-sm text-gray-500 mb-4">Тип файла: {mimeType}</p>
        <a
          href={fileUrl}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md inline-flex items-center space-x-2"
        >
          <span>📥</span>
          <span>Скачать файл</span>
        </a>
      </div>
    );
  };

  return (
    <div className={`bg-white border rounded-lg overflow-hidden ${className}`}>
      <div className="bg-gray-50 px-4 py-2 border-b">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">
            Исходный файл: {fileName}
          </h4>
          <span className="text-xs text-gray-500">{mimeType}</span>
        </div>
      </div>
      <div className="h-full">
        {renderFileContent()}
      </div>
    </div>
  );
};
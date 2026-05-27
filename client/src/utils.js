/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的字符串（如 "1.5 MB"）
 */
export function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++ }
  return bytes.toFixed(1) + ' ' + units[i]
}

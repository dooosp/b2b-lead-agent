function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateParts(date = new Date()) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
  };
}

function formatDateStamp(date = new Date()) {
  const { year, month, day } = toDateParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

function formatKoreanDate(date = new Date()) {
  const { year, month, day } = toDateParts(date);
  return `${year}년 ${month}월 ${day}일`;
}

function formatKoreanDateTime(date = new Date()) {
  return `${formatKoreanDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

module.exports = {
  formatDateStamp,
  formatKoreanDate,
  formatKoreanDateTime,
};

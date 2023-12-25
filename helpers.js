function timeDif(date1, date2) {
  // Convert both dates to milliseconds since Jan 1, 1970 00:00:00 UTC
  const time1 = date1.getTime();
  const time2 = date2.getTime();

  // Calculate the time difference in milliseconds
  const timeDifference = Math.abs(time2 - time1);

  // Convert milliseconds to minutes
  const minutesDifference = Math.floor(timeDifference / (1000 * 60));

  return minutesDifference;
}


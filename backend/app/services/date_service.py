from datetime import date, timedelta

import jpholiday


class DateService:
    """日付計算や営業日取得に関する責務を持つサービス"""

    @staticmethod
    def get_previous_business_day(target_date: date) -> date:
        """
        指定された日付の1営業日前の日付を返す。
        土日および日本の祝日を非営業日とする。

        Args:
            target_date: 基準日
        Returns:
            1営業日前の日付
        """
        prev_date = target_date - timedelta(days=1)
        while prev_date.weekday() >= 5 or jpholiday.is_holiday(prev_date):
            prev_date -= timedelta(days=1)
        return prev_date

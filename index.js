import "aws-sdk";
import moment from "moment-timezone";
import axios from "axios";
import "dotenv/config";

const ENV_BUSINESS_DATES_QUANTITY_TO_STORE = 14;
const CALENDARIFIC_API_KEY = process.env.CALENDARIFIC_API_KEY;
const ENV_CALENDARIFIC_API_URL_BASE = "https://calendarific.com/api/v2";
const ENV_CALENDARIFIC_API_MILLISECONDS_BETWEEN_REQUESTS = 1000;
const CURRENCY_FOR_COUNTRIES = {
  AED: "AE", // UAE Dirham - Unated Arab Emirates (THE)
  EUR: "ES", // Euro - Spain
  GBP: "GB",
  KES: "KE", // Kenyan Shilling - Kenya
  RON: "RO", // Romanian Leu - Romania
  USD: "US",
  ZWL: "ZW", // Zimbabwe Dollar - Zymbabwe
};
const ENV_CUTOFF_TIME = "16:30"; // Should be set as "HH:mm"
const ENV_CUTOFF_TIME_TIMEZONE = "Africa/Nairobi";
const ISO_DATE_FORMAT = "YYYY-MM-DD";
const TIME_OF_DAY_FORMAT = "HH:mm";

class BusinessDatesForCurrencyPair {
  constructor() {
    this.currentYear = undefined;
    this.currentMonth = undefined;
    this.currentDay = undefined;
    this.currentIsoWeekDay = undefined;
    // Example: '2021-10-30'
    this.currentIsoDate = undefined;
    this.currencies = [];
    this.daysOff = undefined;
  }

  init(isoDate = undefined) {
    // const currentMoment = moment().tz(isoDate, ENV_CUTOFF_TIME_TIMEZONE);
    const currentMoment = moment.tz(isoDate, ENV_CUTOFF_TIME_TIMEZONE);
    this.currentYear = currentMoment.year();
    this.currentMonth = currentMoment.month() + 1;
    this.currentDay = currentMoment.date();
    this.currentIsoWeekDay = currentMoment.isoWeekday();
    this.currentIsoDate = currentMoment.format(ISO_DATE_FORMAT);
    this.currencies = Object.keys(CURRENCY_FOR_COUNTRIES).sort();
    console.log(
      `currentYear=${this.currentYear}, currentMonth=${this.currentMonth}, currentDay=${this.currentDay}, currentIsoWeekDay=${this.currentIsoWeekDay}, currentIsoDate=${this.currentIsoDate}`
    );
  }

  async doDelay() {
    return new Promise((resolve) =>
      setTimeout(resolve, ENV_CALENDARIFIC_API_MILLISECONDS_BETWEEN_REQUESTS)
    );
  }

  getUrl(countryCode, year, month = undefined) {
    const monthPart = !!month ? `&month=${month}` : "";
    return `${ENV_CALENDARIFIC_API_URL_BASE}/holidays?&api_key=${CALENDARIFIC_API_KEY}&country=${countryCode}&year=${year}${monthPart}&type=national`;
  }

  getNextIsoDate(isoDate) {
    return moment(isoDate).add(1, "days").format(ISO_DATE_FORMAT);
  }

  async getCalendarificHolidays(countryCode, year, month = undefined) {
    const apiUrl = this.getUrl(countryCode, year, month);
    console.log({ apiUrl });
    try {
      const {
        data: {
          response: { holidays },
        },
        // } = await (await fetch(this.getUrl(countryCode, year, month))).json();
      } = await axios(apiUrl);

      // Get holidays from response and filter it for dates begining from today
      return holidays
        .map((h) => h?.date?.iso)
        .filter((isoDate) => isoDate >= this.currentIsoDate);
    } catch (error) {
      throw `Clandarific API error: ${error}`;
    }
  }

  async getDaysOff() {
    const daysOff = {};

    const needDataFromNextYear =
      this.currentMonth === 12 &&
      this.currentDay > 31 - ENV_BUSINESS_DATES_QUANTITY_TO_STORE;

    let firstTime = true;
    for (const currency of this.currencies) {
      daysOff[currency] = [];

      // Wait a second in a series of requests
      if (!firstTime) {
        await this.doDelay();
      } else {
        firstTime = false;
      }

      daysOff[currency].push(
        ...(await this.getCalendarificHolidays(
          CURRENCY_FOR_COUNTRIES[currency],
          this.currentYear
        ))
      );

      // Get data from the first month of next year if days remains less than specified in the variable
      if (needDataFromNextYear) {
        // Wait a second in a series of requests
        await this.doDelay();
        daysOff[currency].push(
          ...(await this.getCalendarificHolidays(
            CURRENCY_FOR_COUNTRIES[currency],
            this.currentYear + 1,
            1
          ))
        );
      }
    }
    return daysOff;
  }

  getIsoDateNotInHolidaysAndNotInWeekend(holidays, needNextDay = false) {
    let isoDate = needNextDay
      ? this.getNextIsoDate(this.currentIsoDate)
      : this.currentIsoDate;
    for (let i = 0; i < ENV_BUSINESS_DATES_QUANTITY_TO_STORE; i++) {
      const isoWeekday = moment(isoDate).isoWeekday();
      if (!holidays.includes(isoDate) && isoWeekday !== 6 && isoWeekday !== 7) {
        return isoDate;
      }
      isoDate = this.getNextIsoDate(isoDate);
    }
  }

  async fillBusinessDaysForCurrencyPairs(
    // Use next for testing purposes, set some as '2021-12-23'
    isoTestDate = undefined
  ) {
    this.init(isoTestDate);

    const daysOff = await this.getDaysOff();
    this.daysOff = daysOff;

    // await this.businessDatesForCurrencyPairRepository.delete({});
    const businessDatesForCurrencyPairsObj = {};

    // const newEntities = [];
    for (const invoice_currency of this.currencies) {
      for (const client_currency of this.currencies) {
        const commonHolidays = [
          ...this.daysOff[invoice_currency],
          ...this.daysOff[client_currency],
        ];
        const commonUniqueHolidays = [...new Set(commonHolidays)];
        // console.log(`${invoice_currency}-${client_currency}`);
        // console.log({ commonHolidays, commonUniqueHolidays });

        const date_before_cutoff_time =
          this.getIsoDateNotInHolidaysAndNotInWeekend(commonUniqueHolidays);
        const date_after_cutoff_time =
          this.getIsoDateNotInHolidaysAndNotInWeekend(
            commonUniqueHolidays,
            true
          );

        const toSave = {
          invoice_currency,
          client_currency,
          date_before_cutoff_time,
          date_after_cutoff_time,
        };
        // newEntities.push(toSave);
        businessDatesForCurrencyPairsObj[invoice_currency + client_currency] =
          toSave;
      }
    }
    // await this.businessDatesForCurrencyPairRepository.save(newEntities);
    return businessDatesForCurrencyPairsObj;
  }
}

const calculate = async () =>
  await new BusinessDatesForCurrencyPair().fillBusinessDaysForCurrencyPairs();

const calculate2 = () => process.env.CALENDARIFIC_API_KEY;
const calculate3 = () => CALENDARIFIC_API_KEY;

const handler = async (event, context) => {
  console.log("testing cloud watch");
  return {
    statusCode: 200,
    // body: "Hello world",
    // body: await calculate3(),
    body: await calculate(),
    headers: {},
  };
};

export { handler };

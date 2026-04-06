const BEIJING_TZ = 'Asia/Shanghai';

type LocaleArg = string | string[] | undefined;
type DateFormatOptions = Intl.DateTimeFormatOptions | undefined;

function withBeijingTimezone(options?: DateFormatOptions): Intl.DateTimeFormatOptions {
  if (!options) return { timeZone: BEIJING_TZ };
  if (options.timeZone) return options;
  return { ...options, timeZone: BEIJING_TZ };
}

function patchDateLocaleMethod(
  method: 'toLocaleString' | 'toLocaleDateString' | 'toLocaleTimeString'
) {
  const original = Date.prototype[method];
  Date.prototype[method] = function patched(
    this: Date,
    locale?: LocaleArg,
    options?: DateFormatOptions
  ) {
    return original.call(this, locale, withBeijingTimezone(options));
  } as Date[typeof method];
}

export function enforceBeijingTimezone() {
  patchDateLocaleMethod('toLocaleString');
  patchDateLocaleMethod('toLocaleDateString');
  patchDateLocaleMethod('toLocaleTimeString');
}

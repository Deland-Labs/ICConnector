export function withLogging(
  target: any,
  key: string,
  meta: PropertyDescriptor
) {
  const origin = meta.value;

  meta.value = function (...data: any[]) {
    console.log(`${key} Input:`, data);

    const end = (value: any) => {
        console.log(`${key} Output:`, value);

        return value;
      },
      result = origin.apply(this, data);

    if (result instanceof Promise)
      return result.then(end, error => {
        console.warn(`Error in ${key}: ${error}`);

        throw error;
      });

    return end(result);
  };
}


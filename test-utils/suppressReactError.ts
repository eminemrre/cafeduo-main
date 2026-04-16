export const suppressExpectedReactError = (): jest.SpyInstance => {
  const preventJsdomError = (event: Event) => {
    event.preventDefault();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('error', preventJsdomError);
    window.addEventListener('unhandledrejection', preventJsdomError);
  }

  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const restore = spy.mockRestore.bind(spy);

  spy.mockRestore = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', preventJsdomError);
      window.removeEventListener('unhandledrejection', preventJsdomError);
    }
    return restore();
  };

  return spy;
};

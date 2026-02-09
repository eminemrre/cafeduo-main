export const safeReload = () => {
  try {
    window.location.reload();
  } catch {
    // noop
  }
};

export const safeGoHome = () => {
  try {
    window.location.href = '/';
  } catch {
    // noop
  }
};

export const safeReplace = (url: string) => {
  try {
    window.location.replace(url);
  } catch {
    // noop
  }
};


type ReloadTarget = Pick<Location, 'reload'>;
type HomeTarget = Pick<Location, 'href'>;
type ReplaceTarget = Pick<Location, 'replace'>;

const getLocation = (): Location => window.location;

export const safeReload = (location: ReloadTarget = getLocation()) => {
  try {
    location.reload();
  } catch {
    // noop
  }
};

export const safeGoHome = (location: HomeTarget = getLocation()) => {
  try {
    location.href = '/';
  } catch {
    // noop
  }
};

export const safeReplace = (url: string, location: ReplaceTarget = getLocation()) => {
  try {
    location.replace(url);
  } catch {
    // noop
  }
};

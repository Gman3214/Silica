declare module 'feather-icons' {
  export interface FeatherIcon {
    toSvg(options?: { [key: string]: string | number }): string;
  }

  export interface FeatherIcons {
    [key: string]: FeatherIcon;
  }

  const feather: {
    icons: FeatherIcons;
    replace(options?: { [key: string]: string | number }): void;
  };
  
  export default feather;
}

export type MegaControllerConfigurationFolders = {
  label: 'Configuration';
  field: 'configurationfolders';
  type: 'file';
  header: 'Configurations V2';
  description: 'Drop Configurations';
  allowed: ['configuration', 'object-group', 'hud'];
  list: true;
  toggle: true;
  aftercamera: true;
  value: {
    file: string;
    toggled: boolean;
    aftercamera: boolean;
    title: string;
  };
};

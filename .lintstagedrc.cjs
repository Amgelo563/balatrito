module.exports = {
  '{src,__tests__,scripts}/**/*.ts': [
    'prettier --write',
    'eslint --cache --fix',
    'tsc-files --noEmit',
  ],
};

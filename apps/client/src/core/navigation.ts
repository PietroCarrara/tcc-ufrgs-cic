/** O editor registra o encerramento de pendências enquanto está montado. */
export const navigation = {
  beforeLogout: null as null | (() => Promise<boolean>),
};

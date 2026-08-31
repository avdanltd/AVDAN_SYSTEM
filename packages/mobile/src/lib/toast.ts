import Toast from 'react-native-toast-message'

export const toast = {
  success: (message: string, detail?: string) =>
    Toast.show({ type: 'success', text1: message, text2: detail, position: 'top', topOffset: 60 }),
  error: (message: string, detail?: string) =>
    Toast.show({ type: 'error', text1: message, text2: detail, position: 'top', topOffset: 60 }),
  info: (message: string, detail?: string) =>
    Toast.show({ type: 'info', text1: message, text2: detail, position: 'top', topOffset: 60 }),
}

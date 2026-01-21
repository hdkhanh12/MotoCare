import React, { createContext, ReactNode, useContext, useState } from 'react';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { ErrorModal } from '../components/modals/ErrorModal';
import { SuccessModal } from '../components/modals/SuccessModal';

interface ModalContextType {
  showSuccess: (title: string, message: string, onClosed?: () => void) => void;
  showError: (message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  // --- Success Modal State ---
  const [successVisible, setSuccessVisible] = useState(false);
  const [successData, setSuccessData] = useState({ title: '', message: '' });
  const [onSuccessClosed, setOnSuccessClosed] = useState<(() => void) | null>(null);

  // --- Error Modal State ---
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // --- Confirm Modal State ---
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '' });
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);

  const [confirmButtonText, setConfirmButtonText] = useState('Xóa');

  // --- Show Success ---
  const showSuccess = (title: string, message: string, onClosed?: () => void) => {
    setSuccessData({ title, message });
    if (onClosed) setOnSuccessClosed(() => onClosed);
    else setOnSuccessClosed(null);
    setSuccessVisible(true);
  };

  // --- Show Error ---
  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorVisible(true);
  };
  
  // --- Show Confirm ---
  const showConfirm = (title: string, message: string, onConfirm: () => void, text: string = 'Xóa') => {
    setConfirmData({ title, message });
    setOnConfirmAction(() => onConfirm);
    
    setConfirmButtonText(text); 
    
    setConfirmVisible(true);
  };

  const handleConfirmYes = () => {
    setConfirmVisible(false);
    if (onConfirmAction) onConfirmAction();
  };

  const handleConfirmNo = () => {
    setConfirmVisible(false);
  };

  return (
    <ModalContext.Provider value={{ showSuccess, showError, showConfirm }}>
      {children}
      
      <SuccessModal 
        visible={successVisible} title={successData.title} message={successData.message}
        onClose={() => { setSuccessVisible(false); if (onSuccessClosed) onSuccessClosed(); }}
      />

      <ErrorModal 
        visible={errorVisible} message={errorMessage}
        onClose={() => setErrorVisible(false)}
      />

      <ConfirmModal 
        visible={confirmVisible}
        title={confirmData.title}
        message={confirmData.message}
        onConfirm={handleConfirmYes}
        onCancel={handleConfirmNo}
        confirmText={confirmButtonText}
      />
    </ModalContext.Provider>
  );
};

export const useGlobalModal = () => {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useGlobalModal error');
  return context;
};
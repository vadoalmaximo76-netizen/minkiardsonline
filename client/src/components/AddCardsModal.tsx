import React, { useState } from "react";
import { Button } from "./ui/button";
import { X, Upload, Plus } from "lucide-react";
import { socket } from "../lib/socket";
import { useGameState } from "../lib/stores/useGameState";

interface AddCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DeckType = 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali' | 'test';

export const AddCardsModal: React.FC<AddCardsModalProps> = ({ isOpen, onClose }) => {
  const [selectedDeck, setSelectedDeck] = useState<DeckType>('personaggi');
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { gameId, playerName } = useGameState();

  // Listen for cards-added event to reset form
  React.useEffect(() => {
    const handleCardsAdded = () => {
      setUploadedImages([]);
      setIsUploading(false);
      onClose();
    };

    socket.on('cards-added', handleCardsAdded);
    return () => socket.off('cards-added', handleCardsAdded);
  }, [onClose]);

  if (!isOpen) return null;

  const deckOptions = [
    { value: 'personaggi', label: 'PERSONAGGI', color: 'bg-blue-600' },
    { value: 'mosse', label: 'MOSSE', color: 'bg-red-600' },
    { value: 'bonus', label: 'BONUS', color: 'bg-black' },
    { value: 'personaggi_speciali', label: 'PERSONAGGI SPECIALI', color: 'bg-yellow-500' },
    { value: 'test', label: 'TEST', color: 'bg-purple-600' }
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    setUploadedImages(prev => [...prev, ...imageFiles]);
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error(`Immagine troppo grande: ${file.name}. Limite 5MB.`));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAddCards = async () => {
    if (uploadedImages.length === 0) {
      alert('Seleziona almeno un\'immagine!');
      return;
    }

    setIsUploading(true);
    
    try {
      // Convert images to base64
      const base64Images = await Promise.all(
        uploadedImages.map(async (file) => {
          const base64 = await convertToBase64(file);
          return {
            name: file.name,
            data: base64
          };
        })
      );

      // Send to server
      socket.emit('add-custom-cards', {
        gameId,
        playerName,
        deckType: selectedDeck,
        images: base64Images
      });
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Errore durante il caricamento delle immagini');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-white font-bold text-xl">AGGIUNGI CARTE</h3>
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white p-2"
            size="sm"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Deck Selection */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-3">Scegli il mazzo:</h4>
          <div className="grid grid-cols-2 gap-3">
            {deckOptions.map((deck) => (
              <Button
                key={deck.value}
                onClick={() => setSelectedDeck(deck.value as DeckType)}
                className={`${deck.color} hover:opacity-80 text-white font-bold py-3 border-2 ${
                  selectedDeck === deck.value ? 'border-yellow-400' : 'border-transparent'
                }`}
              >
                {deck.label}
              </Button>
            ))}
          </div>
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-3">Carica immagini:</h4>
          <div className="border-2 border-dashed border-gray-400 rounded-lg p-6 text-center">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              <Upload size={40} className="text-gray-400" />
              <span className="text-white">
                Clicca per selezionare immagini
              </span>
              <span className="text-gray-400 text-sm">
                Formati supportati: JPG, PNG, GIF, WEBP
              </span>
            </label>
          </div>
        </div>

        {/* Uploaded Images Preview */}
        {uploadedImages.length > 0 && (
          <div className="mb-6">
            <h4 className="text-white font-semibold mb-3">
              Immagini selezionate ({uploadedImages.length}):
            </h4>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3 max-h-40 overflow-y-auto">
              {uploadedImages.map((file, index) => (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-20 object-cover rounded border-2 border-orange-500"
                  />
                  <Button
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 h-6 w-6"
                    size="sm"
                  >
                    <X size={12} />
                  </Button>
                  <div className="text-xs text-white mt-1 truncate">
                    {file.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Cards Button */}
        <div className="flex gap-3">
          <Button
            onClick={handleAddCards}
            disabled={uploadedImages.length === 0 || isUploading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            {isUploading ? 'CARICAMENTO...' : `AGGIUNGI ${uploadedImages.length} CARTE`}
          </Button>
          
          <Button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6"
          >
            ANNULLA
          </Button>
        </div>
      </div>
    </div>
  );
};
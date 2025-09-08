import React, { useState } from "react";
import { Button } from "./ui/button";
import { X, Calculator as CalcIcon } from "lucide-react";

interface CalculatorProps {
  onClose: () => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ onClose }) => {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? num : display + num);
    }
  };

  const inputOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);

      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue: number, secondValue: number, operation: string) => {
    switch (operation) {
      case "+":
        return firstValue + secondValue;
      case "-":
        return firstValue - secondValue;
      case "×":
        return firstValue * secondValue;
      case "÷":
        return firstValue / secondValue;
      case "=":
        return secondValue;
      default:
        return secondValue;
    }
  };

  const performCalculation = () => {
    if (previousValue !== null && operation) {
      const inputValue = parseFloat(display);
      const newValue = calculate(previousValue, inputValue, operation);
      
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const clear = () => {
    setDisplay("0");
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const clearEntry = () => {
    setDisplay("0");
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
    } else if (display.indexOf(".") === -1) {
      setDisplay(display + ".");
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-600 shadow-lg h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-gray-600">
        <div className="flex items-center gap-2">
          <CalcIcon size={16} className="text-white" />
          <h3 className="text-white font-bold">Calcolatrice</h3>
        </div>
        <Button
          onClick={onClose}
          className="bg-red-600 hover:bg-red-700 text-white p-1 h-8 w-8"
          size="sm"
        >
          <X size={14} />
        </Button>
      </div>

      {/* Display */}
      <div className="p-4 bg-gray-900 mx-3 mt-3 rounded">
        <div className="text-white text-right text-xl font-mono bg-gray-800 p-3 rounded border">
          {display}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex-1 p-3">
        <div className="grid grid-cols-4 gap-2 h-full">
          {/* Row 1 */}
          <Button onClick={clear} className="bg-red-600 hover:bg-red-700 text-white font-bold">
            C
          </Button>
          <Button onClick={clearEntry} className="bg-red-600 hover:bg-red-700 text-white font-bold">
            CE
          </Button>
          <Button onClick={() => inputOperation("÷")} className="bg-orange-600 hover:bg-orange-700 text-white font-bold">
            ÷
          </Button>
          <Button onClick={() => inputOperation("×")} className="bg-orange-600 hover:bg-orange-700 text-white font-bold">
            ×
          </Button>

          {/* Row 2 */}
          <Button onClick={() => inputNumber("7")} className="bg-gray-600 hover:bg-gray-700 text-white font-bold">
            7
          </Button>
          <Button onClick={() => inputNumber("8")} className="bg-gray-600 hover:bg-gray-700 text-white font-bold">
            8
          </Button>
          <Button onClick={() => inputNumber("9")} className="bg-gray-600 hover:bg-gray-700 text-white font-bold">
            9
          </Button>
          <Button onClick={() => inputOperation("-")} className="bg-orange-600 hover:bg-orange-700 text-white font-bold">
            -
          </Button>

          {/* Row 3 */}
          <Button onClick={() => inputNumber("4")} className="bg-gray-600 hover:bg-gray-700 text-white font-bold">
            4
          </Button>
          <Button onClick={() => inputNumber("5")} className="bg-gray-600 hover:bg-gray-700 text-white font-bold">
            5
          </Button>
          <Button onClick={() => inputNumber("6")} className="bg-gray-600 hover:bg-gray-700 text-white font-bold">
            6
          </Button>
          <Button onClick={() => inputOperation("+")} className="bg-orange-600 hover:bg-orange-700 text-white font-bold">
            +
          </Button>

          {/* Row 4 */}
          <Button onClick={() => inputNumber("1")} className="bg-gray-600 hover:bg-gray-700 text-white font-bold">
            1
          </Button>
          <Button onClick={() => inputNumber("2")} className="bg-gray-600 hover:bg-gray-700 text-white font-bold">
            2
          </Button>
          <Button onClick={() => inputNumber("3")} className="bg-gray-600 hover:bg-gray-700 text-white font-bold">
            3
          </Button>
          <Button onClick={performCalculation} className="bg-green-600 hover:bg-green-700 text-white font-bold row-span-2">
            =
          </Button>

          {/* Row 5 */}
          <Button onClick={() => inputNumber("0")} className="bg-gray-600 hover:bg-gray-700 text-white font-bold col-span-2">
            0
          </Button>
          <Button onClick={inputDecimal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold">
            .
          </Button>
        </div>
      </div>
    </div>
  );
};
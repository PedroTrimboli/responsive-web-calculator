"use strict";

const calculator = document.querySelector(".calculator");
const keypad = document.querySelector(".keypad");
const display = document.querySelector("#display");
const history = document.querySelector("#history");
const status = document.querySelector("#status");

const MAX_EXPRESSION_LENGTH = 80;
const OPERATORS = new Set(["+", "-", "*", "/"]);
const DISPLAY_OPERATORS = {
  "*": "X",
  "/": "÷",
  "+": "+",
  "-": "-",
};
const KEYBOARD_OPERATORS = {
  "+": "+",
  "-": "-",
  "*": "*",
  x: "*",
  X: "*",
  "/": "/",
};

let expression = "";
let errorMessage = "";
let justCalculated = false;
let pendingPercentage = null;
let repeatOperation = null;
let notificationTimer;

// A expressão usa os operadores reais; somente esta função cria a versão visual.
function formatForDisplay(value) {
  let formatted = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previousCharacter = value[index - 1];
    const isExponentSign =
      (character === "+" || character === "-") &&
      (previousCharacter === "e" || previousCharacter === "E");
    const isLeadingNegative = character === "-" && index === 0;

    if (OPERATORS.has(character) && !isExponentSign && !isLeadingNegative) {
      formatted += ` ${DISPLAY_OPERATORS[character]} `;
    } else if (isLeadingNegative) {
      formatted += "-";
    } else {
      formatted += character;
    }
  }

  return formatted;
}

function scrollDisplayToEnd() {
  requestAnimationFrame(() => {
    display.scrollLeft = display.scrollWidth;
    history.scrollLeft = history.scrollWidth;
  });
}

function render() {
  const visibleExpression = pendingPercentage
    ? `${formatForDisplay(pendingPercentage.originalExpression)} %`
    : formatForDisplay(expression);

  display.textContent = errorMessage ? "Erro" : visibleExpression || "0";
  calculator.classList.toggle("has-error", Boolean(errorMessage));

  if (errorMessage) {
    status.textContent = errorMessage;
  } else if (justCalculated) {
    status.textContent = "Resultado";
  } else if (expression) {
    status.textContent = "Digitando";
  } else {
    status.textContent = "Pronto";
  }

  scrollDisplayToEnd();
}

function pulseInvalid(message) {
  window.clearTimeout(notificationTimer);
  status.textContent = message;
  calculator.classList.remove("is-invalid");
  void calculator.offsetWidth;
  calculator.classList.add("is-invalid");

  notificationTimer = window.setTimeout(() => {
    calculator.classList.remove("is-invalid");
    render();
  }, 1600);
}

function resetCalculator(clearHistory = true) {
  expression = "";
  errorMessage = "";
  justCalculated = false;
  pendingPercentage = null;
  repeatOperation = null;

  if (clearHistory) {
    history.textContent = "";
  }

  render();
}

function prepareForNewInput() {
  if (errorMessage) {
    resetCalculator(false);
  }

  if (justCalculated) {
    expression = "";
    history.textContent = "";
    justCalculated = false;
  }
}

function getLastOperatorIndex(value) {
  let lastOperatorIndex = -1;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previousCharacter = value[index - 1];
    const isExponentSign =
      (character === "+" || character === "-") &&
      (previousCharacter === "e" || previousCharacter === "E");
    const isLeadingNegative = character === "-" && index === 0;

    if (OPERATORS.has(character) && !isExponentSign && !isLeadingNegative) {
      lastOperatorIndex = index;
    }
  }

  return lastOperatorIndex;
}

function getCurrentNumber() {
  return expression.slice(getLastOperatorIndex(expression) + 1);
}

function canAppend(amount = 1) {
  if (expression.length + amount <= MAX_EXPRESSION_LENGTH) {
    return true;
  }

  pulseInvalid("Limite de caracteres atingido");
  return false;
}

function appendNumber(number) {
  prepareForNewInput();
  pendingPercentage = null;

  const currentNumber = getCurrentNumber();

  if (currentNumber === "0") {
    expression = `${expression.slice(0, -1)}${number}`;
  } else if (currentNumber === "-0") {
    expression = `${expression.slice(0, -1)}${number}`;
  } else if (canAppend()) {
    expression += number;
  }

  render();
}

function appendDecimal() {
  prepareForNewInput();
  pendingPercentage = null;

  const currentNumber = getCurrentNumber();

  if (currentNumber.includes(".")) {
    pulseInvalid("Este número já possui um ponto");
    return;
  }

  if (!canAppend(currentNumber === "" || currentNumber === "-" ? 2 : 1)) {
    return;
  }

  if (currentNumber === "") {
    expression += "0.";
  } else if (currentNumber === "-") {
    expression += "0.";
  } else {
    expression += ".";
  }

  render();
}

function appendOperator(operator) {
  if (errorMessage) {
    pulseInvalid("Comece com um número");
    return;
  }

  if (!expression) {
    if (operator === "-") {
      expression = "-";
      render();
    } else {
      pulseInvalid("Comece com um número");
    }
    return;
  }

  if (expression === "-" || OPERATORS.has(expression.at(-1))) {
    pulseInvalid("Evite operadores consecutivos");
    return;
  }

  if (!canAppend()) {
    return;
  }

  if (justCalculated) {
    history.textContent = "";
  }

  pendingPercentage = null;
  expression += operator;
  justCalculated = false;
  render();
}

function deleteLastCharacter() {
  if (errorMessage) {
    resetCalculator();
    return;
  }

  expression = expression.slice(0, -1);
  justCalculated = false;
  pendingPercentage = null;
  repeatOperation = null;
  history.textContent = "";
  render();
}

function applyPercent() {
  if (errorMessage) {
    pulseInvalid("Comece com um número");
    return;
  }

  if (!expression || expression === "-" || OPERATORS.has(expression.at(-1))) {
    pulseInvalid("Digite um número para calcular a porcentagem");
    return;
  }

  const originalExpression = expression;

  try {
    const operatorIndex = getLastOperatorIndex(expression);
    const currentNumberText = expression.slice(operatorIndex + 1);
    const currentNumber = Number(currentNumberText);

    if (!Number.isFinite(currentNumber)) {
      throw new Error("INVALID_EXPRESSION");
    }

    let percentageValue = currentNumber / 100;

    if (operatorIndex >= 0) {
      const operator = expression[operatorIndex];
      const previousExpression = expression.slice(0, operatorIndex);

      if (operator === "+" || operator === "-") {
        const baseValue = evaluateExpression(previousExpression);
        percentageValue = (baseValue * currentNumber) / 100;
      }

      expression = `${previousExpression}${operator}${normalizeResult(percentageValue)}`;
      pendingPercentage = {
        operator,
        rate: currentNumber,
        originalExpression,
      };
      justCalculated = false;
    } else {
      expression = normalizeResult(percentageValue);
      history.textContent = "";
      pendingPercentage = {
        operator: null,
        rate: currentNumber,
        originalExpression,
      };
      repeatOperation = null;
      justCalculated = true;
    }

    errorMessage = "";
    render();
  } catch (error) {
    history.textContent = formatForDisplay(originalExpression);
    expression = "";
    justCalculated = false;
    pendingPercentage = null;
    repeatOperation = null;
    errorMessage =
      error.message === "DIVISION_BY_ZERO"
        ? "Divisão por zero"
        : "Operação inválida";
    render();
  }
}

function readNumber(source, startIndex, allowLeadingNegative) {
  let index = startIndex;
  let sign = 1;

  if (allowLeadingNegative && source[index] === "-") {
    sign = -1;
    index += 1;
  }

  const match = source
    .slice(index)
    .match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);

  if (!match) {
    throw new Error("INVALID_EXPRESSION");
  }

  const number = Number(match[0]) * sign;

  if (!Number.isFinite(number)) {
    throw new Error("INVALID_RESULT");
  }

  return {
    number,
    nextIndex: index + match[0].length,
  };
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  let expectsNumber = true;

  while (index < source.length) {
    if (expectsNumber) {
      const parsed = readNumber(source, index, index === 0);
      tokens.push(parsed.number);
      index = parsed.nextIndex;
      expectsNumber = false;
      continue;
    }

    const operator = source[index];

    if (!OPERATORS.has(operator)) {
      throw new Error("INVALID_EXPRESSION");
    }

    tokens.push(operator);
    index += 1;
    expectsNumber = true;
  }

  if (expectsNumber || tokens.length === 0) {
    throw new Error("INVALID_EXPRESSION");
  }

  return tokens;
}

// Primeira passagem resolve multiplicação e divisão; a segunda resolve soma e subtração.
function evaluateExpression(source) {
  const tokens = tokenize(source);
  const reducedTokens = [tokens[0]];

  for (let index = 1; index < tokens.length; index += 2) {
    const operator = tokens[index];
    const nextNumber = tokens[index + 1];

    if (operator === "*" || operator === "/") {
      const previousNumber = reducedTokens.pop();

      if (operator === "/" && nextNumber === 0) {
        throw new Error("DIVISION_BY_ZERO");
      }

      const partialResult =
        operator === "*"
          ? previousNumber * nextNumber
          : previousNumber / nextNumber;

      if (!Number.isFinite(partialResult)) {
        throw new Error("INVALID_RESULT");
      }

      reducedTokens.push(partialResult);
    } else {
      reducedTokens.push(operator, nextNumber);
    }
  }

  let result = reducedTokens[0];

  for (let index = 1; index < reducedTokens.length; index += 2) {
    const operator = reducedTokens[index];
    const nextNumber = reducedTokens[index + 1];
    result = operator === "+" ? result + nextNumber : result - nextNumber;
  }

  if (!Number.isFinite(result)) {
    throw new Error("INVALID_RESULT");
  }

  return result;
}

function normalizeResult(result) {
  if (Object.is(result, -0)) {
    return "0";
  }

  return String(Number(result.toPrecision(12)));
}

function createRepeatOperation(source, percentageContext) {
  if (percentageContext) {
    if (!percentageContext.operator) {
      return null;
    }

    return {
      operator: percentageContext.operator,
      operand: percentageContext.rate,
      isPercent: true,
    };
  }

  const operatorIndex = getLastOperatorIndex(source);

  if (operatorIndex < 0) {
    return null;
  }

  const operand = Number(source.slice(operatorIndex + 1));

  if (!Number.isFinite(operand)) {
    throw new Error("INVALID_EXPRESSION");
  }

  return {
    operator: source[operatorIndex],
    operand,
    isPercent: false,
  };
}

function applyRepeatOperation(value, operation) {
  let operand = operation.operand;

  if (!Number.isFinite(value) || !Number.isFinite(operand)) {
    throw new Error("INVALID_RESULT");
  }

  if (operation.isPercent) {
    operand =
      operation.operator === "+" || operation.operator === "-"
        ? (value * operand) / 100
        : operand / 100;
  }

  if (operation.operator === "/" && operand === 0) {
    throw new Error("DIVISION_BY_ZERO");
  }

  const operations = {
    "+": () => value + operand,
    "-": () => value - operand,
    "*": () => value * operand,
    "/": () => value / operand,
  };
  const result = operations[operation.operator]?.();

  if (!Number.isFinite(result)) {
    throw new Error("INVALID_RESULT");
  }

  return result;
}

function formatRepeatExpression(value, operation) {
  const operand = formatForDisplay(normalizeResult(operation.operand));
  const percentSymbol = operation.isPercent ? " %" : "";

  return `${formatForDisplay(value)} ${DISPLAY_OPERATORS[operation.operator]} ${operand}${percentSymbol}`;
}

function calculate() {
  if (errorMessage) {
    return;
  }

  if (!expression || expression === "-" || OPERATORS.has(expression.at(-1))) {
    pulseInvalid("Complete a operação");
    return;
  }

  const originalExpression = expression;
  const percentageContext = pendingPercentage;

  try {
    const operatorIndex = getLastOperatorIndex(originalExpression);
    let result;
    let visibleCalculation;

    if (operatorIndex < 0 && repeatOperation) {
      const currentValue = Number(originalExpression);

      if (!Number.isFinite(currentValue)) {
        throw new Error("INVALID_EXPRESSION");
      }

      result = applyRepeatOperation(currentValue, repeatOperation);
      visibleCalculation = formatRepeatExpression(
        originalExpression,
        repeatOperation,
      );
    } else {
      result = evaluateExpression(originalExpression);
      repeatOperation = createRepeatOperation(
        originalExpression,
        percentageContext,
      );
      visibleCalculation = percentageContext
        ? `${formatForDisplay(percentageContext.originalExpression)} %`
        : formatForDisplay(originalExpression);
    }

    expression = normalizeResult(result);
    history.textContent = `${visibleCalculation} =`;
    errorMessage = "";
    justCalculated = true;
    pendingPercentage = null;
    render();
  } catch (error) {
    history.textContent = percentageContext
      ? `${formatForDisplay(percentageContext.originalExpression)} %`
      : formatForDisplay(originalExpression);
    expression = "";
    justCalculated = false;
    pendingPercentage = null;
    repeatOperation = null;
    errorMessage =
      error.message === "DIVISION_BY_ZERO"
        ? "Divisão por zero"
        : "Operação inválida";
    render();
  }
}

function runAction(action, value) {
  const actions = {
    number: () => appendNumber(value),
    decimal: appendDecimal,
    percent: applyPercent,
    operator: () => appendOperator(value),
    calculate,
    delete: deleteLastCharacter,
    clear: resetCalculator,
  };

  actions[action]?.();
}

function animateKey(button) {
  if (!button) {
    return;
  }

  button.classList.remove("is-pressed");
  void button.offsetWidth;
  button.classList.add("is-pressed");
  window.setTimeout(() => button.classList.remove("is-pressed"), 120);
}

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  runAction(button.dataset.action, button.dataset.value);
});

// O teclado envia os mesmos valores internos usados pelos botões.
document.addEventListener("keydown", (event) => {
  const { key } = event;
  let button;

  if (/^\d$/.test(key)) {
    event.preventDefault();
    button = keypad.querySelector(`[data-action="number"][data-value="${key}"]`);
    appendNumber(key);
  } else if (KEYBOARD_OPERATORS[key]) {
    const operator = KEYBOARD_OPERATORS[key];
    event.preventDefault();
    button = keypad.querySelector(
      `[data-action="operator"][data-value="${operator}"]`,
    );
    appendOperator(operator);
  } else if (key === "%") {
    event.preventDefault();
    button = keypad.querySelector('[data-action="percent"]');
    applyPercent();
  } else if (key === ".") {
    event.preventDefault();
    button = keypad.querySelector('[data-action="decimal"]');
    appendDecimal();
  } else if (key === "Enter" || key === "=") {
    event.preventDefault();
    button = keypad.querySelector('[data-action="calculate"]');
    calculate();
  } else if (key === "Backspace") {
    event.preventDefault();
    button = keypad.querySelector('[data-action="delete"]');
    deleteLastCharacter();
  } else if (key === "Delete" || key === "Escape") {
    event.preventDefault();
    button = keypad.querySelector('[data-action="clear"]');
    resetCalculator();
  } else {
    return;
  }

  animateKey(button);
});

render();

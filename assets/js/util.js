function transactionCostInWei(gasUsed, gasPrice, value) {
  const transactionFee = gasUsed.mul(gasPrice);
  return transactionFee.add(value);
}

export default { transactionCostInWei };

export const mockUsernameLookupService = {
  getUserName: async (name) => {
    const names = {
      UEHR7VBBP: "Deepthi",
      USX4VT2AC: "Kristof Jozsa",
      UTM6C2C3H: "archivist2",
      UEVLBF0TA: "Josh Wulf",
      UQWBVA7EE: "Sarath Kumar",
      U019Q8QL2NQ: "Mohit Mehra",
      UUUKGMW1M: "korthout",
      UPYL2HML3: "Tiese Barrell",
      U6XL8AN3V: "saig0",
      UTRJSKNRZ: "archivist2",
    };
    return names[name];
  },
};

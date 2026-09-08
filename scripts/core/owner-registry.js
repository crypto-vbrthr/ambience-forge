export class OwnerRegistry {
  constructor() {
    this.ownersByKey = new Map();
  }

  request(key, owner) {
    if (!owner) throw new Error("Owner is required");
    const owners = this.ownersByKey.get(key) ?? new Set();
    const wasEmpty = owners.size === 0;
    owners.add(owner);
    this.ownersByKey.set(key, owners);
    return { wasEmpty, count: owners.size };
  }

  release(key, owner) {
    const owners = this.ownersByKey.get(key);
    if (!owners) return { becameEmpty: false, count: 0 };
    owners.delete(owner);
    if (!owners.size) this.ownersByKey.delete(key);
    return { becameEmpty: owners.size === 0, count: owners.size };
  }

  owners(key) {
    return [...(this.ownersByKey.get(key) ?? [])];
  }

  clear(key) {
    this.ownersByKey.delete(key);
  }

  clearAll() {
    this.ownersByKey.clear();
  }
}

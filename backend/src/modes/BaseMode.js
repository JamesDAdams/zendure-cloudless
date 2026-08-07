export class BaseMode {
  constructor(name) {
    this.name = name
  }

  async tick(device, context) {
    throw new Error('tick not implemented')
  }
}

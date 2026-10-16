// node src/lib/folder-picker.check.mts
import assert from 'node:assert/strict'
import { pickerCommand, pickFolder } from './folder-picker.ts'

const mac = pickerCommand('darwin', 'Pick "a" folder')
assert.equal(mac?.cmd, 'osascript')
assert.match(mac?.args[1] ?? '', /choose folder with prompt "Pick \\"a\\" folder"/, 'the prompt is quoted, so it cannot end the script')
assert.equal(pickerCommand('win32', 'x')?.cmd, 'powershell')
assert.deepEqual(pickerCommand('linux', 'x')?.args.slice(0, 2), ['--file-selection', '--directory'])
assert.equal(pickerCommand('aix', 'x'), null)
assert.deepEqual(await pickFolder('x', 'aix'), { unsupported: true })

console.log('folder-picker: ok')

import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { nutrition } from 'data-platform'
import { fakeTargetsPort } from './fake-targets-port.ts'
import type { Targets, TargetsPort } from './targets-port.ts'
import { fakeSettingsPort } from '../settings/fake-settings-port.ts'
import { TargetsScreen } from './TargetsScreen.tsx'

function type(label: string, value: string) {
  fireEvent.input(screen.getByLabelText(label), { target: { value } })
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
}

/** What the port currently holds. */
function stored(port: TargetsPort): Targets | null {
  let current: Targets | null = null
  port.subscribe((targets) => (current = targets), () => {})()
  return current
}

describe('TargetsScreen', () => {
  it('prefills each field from the current Targets and leaves an unset Target empty', async () => {
    const port = fakeTargetsPort()
    await port.write({ kcal: nutrition.kcal(2000), proteinG: nutrition.grams(150) })
    render(<TargetsScreen port={port} settings={fakeSettingsPort()} onLeave={vi.fn()} />)
    expect(await screen.findByLabelText('Calories (kcal)')).toHaveValue(2000)
    expect(screen.getByLabelText('Protein (g)')).toHaveValue(150)
    expect(screen.getByLabelText('Carbs (g)')).toHaveValue(null)
    expect(screen.getByLabelText('Fat (g)')).toHaveValue(null)
  })

  it('shows empty fields when no Targets are set', async () => {
    render(<TargetsScreen port={fakeTargetsPort()} settings={fakeSettingsPort()} onLeave={vi.fn()} />)
    expect(await screen.findByLabelText('Calories (kcal)')).toHaveValue(null)
  })

  it.each(['0', '-5'])('blocks saving %s with a message on that field', async (value) => {
    const port = fakeTargetsPort()
    const write = vi.spyOn(port, 'write')
    render(<TargetsScreen port={port} settings={fakeSettingsPort()} onLeave={vi.fn()} />)
    await screen.findByLabelText('Protein (g)')
    type('Protein (g)', value)
    save()
    expect(screen.getByRole('alert')).toHaveTextContent(/above zero/)
    expect(screen.getByLabelText('Protein (g)')).toBeInvalid()
    expect(write).not.toHaveBeenCalled()
  })

  it('blocks saving text the number field cannot parse, and counts it as an unsaved change', async () => {
    const port = fakeTargetsPort()
    await port.write({ proteinG: nutrition.grams(150) })
    const write = vi.spyOn(port, 'write')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<TargetsScreen port={port} settings={fakeSettingsPort()} onLeave={vi.fn()} />)
    const field = await screen.findByLabelText('Protein (g)')
    Object.defineProperty(field, 'validity', { value: { badInput: true }, configurable: true })
    type('Protein (g)', '')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent(/Enter a number/)
    expect(field).toBeInvalid()
    expect(write).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(confirm).toHaveBeenCalled()
  })

  it('reports every invalid field at once', async () => {
    const port = fakeTargetsPort()
    const write = vi.spyOn(port, 'write')
    render(<TargetsScreen port={port} settings={fakeSettingsPort()} onLeave={vi.fn()} />)
    await screen.findByLabelText('Protein (g)')
    type('Protein (g)', '0')
    type('Fat (g)', '-1')
    save()
    expect(screen.getByLabelText('Protein (g)')).toBeInvalid()
    expect(screen.getByLabelText('Fat (g)')).toBeInvalid()
    expect(write).not.toHaveBeenCalled()
  })

  it('follows Targets changed elsewhere while there are no unsaved edits', async () => {
    const port = fakeTargetsPort()
    render(<TargetsScreen port={port} settings={fakeSettingsPort()} onLeave={vi.fn()} />)
    await screen.findByLabelText('Protein (g)')
    await port.write({ proteinG: nutrition.grams(180) })
    await waitFor(() => expect(screen.getByLabelText('Protein (g)')).toHaveValue(180))
  })

  it('keeps unsaved edits when the Targets change elsewhere', async () => {
    const port = fakeTargetsPort()
    render(<TargetsScreen port={port} settings={fakeSettingsPort()} onLeave={vi.fn()} />)
    await screen.findByLabelText('Protein (g)')
    type('Protein (g)', '150')
    await port.write({ kcal: nutrition.kcal(2000) })
    await new Promise((resolve) => setTimeout(resolve))
    expect(screen.getByLabelText('Protein (g)')).toHaveValue(150)
  })

  it("keeps the form and the Member's edits when the port errors after loading", async () => {
    let fail: (error: Error) => void = () => {}
    const port: TargetsPort = {
      subscribe: (onChange, onError) => {
        onChange(null)
        fail = onError
        return () => {}
      },
      write: async () => {},
    }
    render(<TargetsScreen port={port} settings={fakeSettingsPort()} onLeave={vi.fn()} />)
    await screen.findByLabelText('Protein (g)')
    type('Protein (g)', '150')
    fail(new Error('lost connection'))
    expect(await screen.findByRole('alert')).toHaveTextContent('lost connection')
    expect(screen.getByLabelText('Protein (g)')).toHaveValue(150)
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('ignores a second Save while the write is in flight', async () => {
    const port = fakeTargetsPort()
    let release: () => void = () => {}
    const write = vi.spyOn(port, 'write').mockReturnValue(new Promise<void>((resolve) => (release = resolve)))
    render(<TargetsScreen port={port} settings={fakeSettingsPort()} onLeave={vi.fn()} />)
    await screen.findByLabelText('Protein (g)')
    type('Protein (g)', '150')
    save()
    save()
    expect(write).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    release()
  })

  it('writes the filled fields through the port and leaves an empty one unset', async () => {
    const port = fakeTargetsPort()
    await port.write({ kcal: nutrition.kcal(2000), fatG: nutrition.grams(60) })
    render(<TargetsScreen port={port} settings={fakeSettingsPort()} onLeave={vi.fn()} />)
    await screen.findByLabelText('Protein (g)')
    type('Protein (g)', '150')
    type('Fat (g)', '')
    save()
    await waitFor(() => expect(stored(port)).toEqual({ kcal: 2000, proteinG: 150 }))
  })

  it('shows why a write failed', async () => {
    const port = fakeTargetsPort()
    vi.spyOn(port, 'write').mockRejectedValue(new Error('offline'))
    render(<TargetsScreen port={port} settings={fakeSettingsPort()} onLeave={vi.fn()} />)
    await screen.findByLabelText('Protein (g)')
    type('Protein (g)', '150')
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
  })

  describe('leaving', () => {
    function back() {
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    }

    it('leaves at once when nothing has changed', async () => {
      const onLeave = vi.fn()
      const confirm = vi.spyOn(window, 'confirm')
      render(<TargetsScreen port={fakeTargetsPort()} settings={fakeSettingsPort()} onLeave={onLeave} />)
      await screen.findByLabelText('Protein (g)')
      back()
      expect(confirm).not.toHaveBeenCalled()
      expect(onLeave).toHaveBeenCalled()
    })

    it('asks first with unsaved changes, and stays when the Member declines', async () => {
      const onLeave = vi.fn()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<TargetsScreen port={fakeTargetsPort()} settings={fakeSettingsPort()} onLeave={onLeave} />)
      await screen.findByLabelText('Protein (g)')
      type('Protein (g)', '150')
      back()
      expect(confirm).toHaveBeenCalled()
      expect(onLeave).not.toHaveBeenCalled()
    })

    it('leaves with unsaved changes once the Member agrees to discard them', async () => {
      const onLeave = vi.fn()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<TargetsScreen port={fakeTargetsPort()} settings={fakeSettingsPort()} onLeave={onLeave} />)
      await screen.findByLabelText('Protein (g)')
      type('Protein (g)', '150')
      back()
      expect(onLeave).toHaveBeenCalled()
    })

    it('leaves without asking after a save', async () => {
      const onLeave = vi.fn()
      const confirm = vi.spyOn(window, 'confirm')
      const port = fakeTargetsPort()
      render(<TargetsScreen port={port} settings={fakeSettingsPort()} onLeave={onLeave} />)
      await screen.findByLabelText('Protein (g)')
      type('Protein (g)', '150')
      save()
      await waitFor(() => expect(stored(port)).toEqual({ proteinG: 150 }))
      await new Promise((resolve) => setTimeout(resolve))
      back()
      expect(confirm).not.toHaveBeenCalled()
      expect(onLeave).toHaveBeenCalled()
    })
  })

  describe('Push to Google Health switch', () => {
    it('is off by default, with a note that pushing needs a linked Google account', async () => {
      render(<TargetsScreen port={fakeTargetsPort()} settings={fakeSettingsPort()} onLeave={vi.fn()} />)
      const toggle = await screen.findByRole('switch', { name: 'Push to Google Health' })
      expect(toggle).not.toBeChecked()
      expect(screen.getByText(/Google account linked in the Google Health app/)).toBeInTheDocument()
      expect(toggle).toHaveAccessibleDescription(/Google account linked in the Google Health app/)
    })

    it('writes the switch to the settings port and shows it on again after a reload', async () => {
      const settings = fakeSettingsPort()
      const view = render(<TargetsScreen port={fakeTargetsPort()} settings={settings} onLeave={vi.fn()} />)
      fireEvent.click(await screen.findByRole('switch', { name: 'Push to Google Health' }))
      await waitFor(() => expect(screen.getByRole('switch')).toBeChecked())
      view.unmount()
      render(<TargetsScreen port={fakeTargetsPort()} settings={settings} onLeave={vi.fn()} />)
      expect(await screen.findByRole('switch', { name: 'Push to Google Health' })).toBeChecked()
    })

    it('turns off again, and does not count as an unsaved change', async () => {
      const settings = fakeSettingsPort()
      await settings.setGoogleHealthSync(true)
      const onLeave = vi.fn()
      const confirm = vi.spyOn(window, 'confirm')
      render(<TargetsScreen port={fakeTargetsPort()} settings={settings} onLeave={onLeave} />)
      fireEvent.click(await screen.findByRole('switch', { name: 'Push to Google Health' }))
      await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked())
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(confirm).not.toHaveBeenCalled()
      expect(onLeave).toHaveBeenCalled()
    })

    it('shows a message when the switch cannot be saved', async () => {
      const settings = fakeSettingsPort()
      vi.spyOn(settings, 'setGoogleHealthSync').mockRejectedValue(new Error('offline'))
      render(<TargetsScreen port={fakeTargetsPort()} settings={settings} onLeave={vi.fn()} />)
      fireEvent.click(await screen.findByRole('switch', { name: 'Push to Google Health' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('offline')
      expect(screen.getByRole('switch')).not.toBeChecked()
    })
  })
})

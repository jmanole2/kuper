import { Button } from '@/components/Button'

export default function NotFound() {
  return (
    <section className="section legal">
      <div className="container legal__inner">
        <h1 className="h2 h2--lg">Página no encontrada</h1>
        <p className="lead">La página que buscas no existe o cambió de dirección.</p>
        <div className="btn-row">
          <Button href="/">Volver al inicio</Button>
        </div>
      </div>
    </section>
  )
}

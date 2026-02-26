import { useKeyNav } from '../../hooks/useKeyNav'
import styles from './PersonaSelector.module.css'

export function PersonaSelector({ personas, onSelect }) {
  const cursor = useKeyNav(personas, onSelect)

  return (
    <div className={styles.selector}>
      <p className={styles.prompt}>pick your scene partner...</p>
      <ul className={styles.list}>
        {personas.map((persona, index) => (
          <li
            key={persona.id}
            className={`${styles.item} ${index === cursor ? styles.highlighted : ''}`}
          >
            {index === cursor ? '▶ ' : '  '}{persona.name}
          </li>
        ))}
      </ul>
      <p className={styles.hint}>up/down to navigate, enter to load</p>
    </div>
  )
}

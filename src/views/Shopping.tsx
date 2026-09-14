import { SHOPPING } from '../data/shopping';
import { useAppState } from '../state';

export function Shopping() {
  const { data, toggleShopping, clearShopping } = useAppState();
  const items = SHOPPING.flatMap((category) => category.items);
  const checked = items.filter((item) => data.shopping[item.id]).length;

  return (
    <>
      <header class="page-header title-row">
        <div>
          <h1>Shopping</h1>
          <p class="meta">{`${checked} of ${items.length} checked`}</p>
        </div>
        <button type="button" class="button-secondary" onClick={clearShopping} disabled={checked === 0}>
          New week
        </button>
      </header>

      {SHOPPING.map((category, index) => (
        <section key={category.name} class="group" aria-labelledby={`shopping-${index}`}>
          <h2 id={`shopping-${index}`}>{category.name}</h2>
          <ul class="card list">
            {category.items.map((item) => (
              <li key={item.id}>
                <label class="check">
                  <input
                    type="checkbox"
                    checked={Boolean(data.shopping[item.id])}
                    onChange={() => toggleShopping(item.id)}
                  />
                  <span>{item.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

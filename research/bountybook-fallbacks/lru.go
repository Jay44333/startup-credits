package lru

import "sync"

type node[K comparable, V any] struct {
	key        K
	value      V
	prev, next *node[K, V]
}

type Cache[K comparable, V any] struct {
	mu       sync.Mutex
	capacity int
	items    map[K]*node[K, V]
	head     *node[K, V]
	tail     *node[K, V]
}

func New[K comparable, V any](capacity int) *Cache[K, V] {
	if capacity < 0 {
		capacity = 0
	}
	return &Cache[K, V]{capacity: capacity, items: make(map[K]*node[K, V])}
}

func (c *Cache[K, V]) moveToFront(n *node[K, V]) {
	if c.head == n {
		return
	}
	if n.prev != nil {
		n.prev.next = n.next
	}
	if n.next != nil {
		n.next.prev = n.prev
	}
	if c.tail == n {
		c.tail = n.prev
	}
	n.prev = nil
	n.next = c.head
	if c.head != nil {
		c.head.prev = n
	}
	c.head = n
	if c.tail == nil {
		c.tail = n
	}
}

func (c *Cache[K, V]) Get(key K) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	n, ok := c.items[key]
	if !ok {
		var zero V
		return zero, false
	}
	c.moveToFront(n)
	return n.value, true
}

func (c *Cache[K, V]) Put(key K, value V) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.capacity == 0 {
		return
	}
	if n, ok := c.items[key]; ok {
		n.value = value
		c.moveToFront(n)
		return
	}
	n := &node[K, V]{key: key, value: value, next: c.head}
	if c.head != nil {
		c.head.prev = n
	}
	c.head = n
	if c.tail == nil {
		c.tail = n
	}
	c.items[key] = n
	if len(c.items) > c.capacity {
		old := c.tail
		if old != nil {
			c.tail = old.prev
			if c.tail != nil {
				c.tail.next = nil
			} else {
				c.head = nil
			}
			delete(c.items, old.key)
		}
	}
}

func (c *Cache[K, V]) Delete(key K) {
	c.mu.Lock()
	defer c.mu.Unlock()
	n, ok := c.items[key]
	if !ok {
		return
	}
	if n.prev != nil {
		n.prev.next = n.next
	} else {
		c.head = n.next
	}
	if n.next != nil {
		n.next.prev = n.prev
	} else {
		c.tail = n.prev
	}
	delete(c.items, key)
}

func (c *Cache[K, V]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.items)
}

const { Router } = require('express');
const Users = require('../models/users.model');
const passportCall = require('../utils/passport-call.util');
const { customizeError } = require('../services/error.services');

const router = Router();

router.get('/users', async (req, res) => {
  if (req.user.role === 'admin' || req.user.role === 'premium') {
    try {
      const users = await Users.find();

      res.json({
        status: 'success',
        payload: users,
      });
    } catch (error) {
      const errorMessage = customizeError('INTERNAL_SERVER_ERROR');
      res.status(500).json({status: 'error', error: errorMessage });
    }
  } else {
    const errorMessage = customizeError('UNAUTHORIZED_ACCESS');
    res.status(500).json({status: 'error', error: errorMessage });
  }
});

// Ruta para cambiar el rol de un usuario entre "user" y "premium"
router.put('/users/premium/:uid', async (req, res) => {
  try {
    // Obtiene el ID del usuario a modificar desde los parámetros de la URL
    const userId = req.params.uid;

    // Busca el usuario en la base de datos
    const user = await Users.findById(userId);

    // Verifica si el usuario existe
    if (!user) {
      return res.status(404).json({ status: 'error', error: customizeError('USER_NOT_FOUND') });
    }

    // Cambia el rol del usuario
    user.role = user.role === 'user' ? 'premium' : 'user';

    // Guarda los cambios en la base de datos
    await user.save();

    // Retorna una respuesta exitosa
    res.json({ status: 'success', message: 'User role updated successfully', user });
  } catch (error) {
    // Manejo de errores
    console.error(error);
    res.status(500).json({ status: 'error', error: customizeError('INTERNAL_SERVER_ERROR') });
  }
});

router.post('/cart', async (req, res) => {
  try {
      const { user, products, total } = req.body;
      const newCartInfo = { user, products, total };
      const newCart = await cartsController.createCart(newCartInfo);
      res.json({ payload: newCart });
  } catch (error) {
      const errorMessage = customizeError('ERROR_CART');
      res.status(500).json({ error: errorMessage });
  }
});

router.put('/cart/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const body = req.body;
      await cartsController.updateCart(id, body);
      res.json({ payload: 'Carrito actualizado' });
  } catch (error) {
      const errorMessage = customizeError('ERROR_CART');
      res.status(500).json({ error: errorMessage });
  }
});

router.get('/cart/:id/total', async (req, res) => {
  try {
      const { id } = req.body;
      const totalPrice = await cartsController.getCartTotalPrice(id);
      res.json({ status: 'success', totalPrice });
  } catch (error) {
      const errorMessage = customizeError('ERROR_CART');
      res.status(500).json({ error: errorMessage });
  }
});

router.get('/session/current', passportCall('jwt'), (req, res) => {
  try {
      res.json({ status: 'success', payload: req.headers })
  } catch (error) {
      const errorMessage = customizeError('INTERNAL_SERVER_ERROR');
      res.status(500).json({ error: errorMessage });
  }
});

router.get('/session', (req, res) => {
  try {
      res.json({ status: 'success', payload: req.session })
  } catch (error) {
      const errorMessage = customizeError('INTERNAL_SERVER_ERROR');
      res.status(500).json({ error: errorMessage });
  }
});

module.exports = router;
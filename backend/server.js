import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  maxHttpBufferSize: 1e7, // 10MB to support Base64 images
  cors: {
    origin: '*', // For testing purposes, allow all origins
    methods: ['GET', 'POST']
  }
});

// In-memory data store
let auctions = [];

// HTTP endpoint for healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok', auctionsCount: auctions.length });
});

// HTTP endpoint to get auctions (as backup or debug)
app.get('/api/auctions', (req, res) => {
  res.json(auctions);
});

// HTTP endpoint to reset data (useful for testing)
app.post('/api/reset', (req, res) => {
  auctions = [];
  io.emit('data_reset');
  res.json({ message: 'Data reset successfully' });
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Send the current list of auctions to the newly connected user
  socket.emit('auctions_list', auctions);

  // Handle: Create Auction
  socket.on('create_auction', (data) => {
    const { buyerName, product, quantity, unit, description, targetPrice, images } = data;
    
    if (!buyerName || !product || !quantity || !unit) {
      socket.emit('error', { message: 'Missing required fields for auction creation.' });
      return;
    }

    const newAuction = {
      id: `auc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      buyerName,
      product,
      quantity: parseFloat(quantity),
      unit,
      description: description || '',
      targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      images: images || [], // Store image base64 strings
      status: 'open', // 'open' or 'closed'
      createdAt: new Date().toISOString(),
      bids: [],
      acceptedBidId: null
    };

    auctions.push(newAuction);
    console.log(`New auction created: ${newAuction.id} by ${buyerName}`);
    
    // Broadcast to all clients (both buyers and producers)
    io.emit('auction_created', newAuction);
  });

  // Handle: Place Bid
  socket.on('place_bid', (data) => {
    const { auctionId, producerName, price, comments } = data;

    if (!auctionId || !producerName || price === undefined) {
      socket.emit('error', { message: 'Missing required fields for placing a bid.' });
      return;
    }

    const auction = auctions.find(a => a.id === auctionId);
    if (!auction) {
      socket.emit('error', { message: 'Auction not found.' });
      return;
    }

    if (auction.status !== 'open') {
      socket.emit('error', { message: 'Auction is already closed.' });
      return;
    }

    const newBid = {
      id: `bid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      producerName,
      price: parseFloat(price),
      comments: comments || '',
      timestamp: new Date().toISOString()
    };

    auction.bids.push(newBid);
    console.log(`New bid placed on auction ${auctionId} by ${producerName}: ${price}`);

    // Broadcast updated auction to everyone
    io.emit('auction_updated', auction);
  });

  // Handle: Accept Bid / Validate Auction
  socket.on('accept_bid', (data) => {
    const { auctionId, bidId } = data;

    if (!auctionId || !bidId) {
      socket.emit('error', { message: 'Missing auctionId or bidId.' });
      return;
    }

    const auction = auctions.find(a => a.id === auctionId);
    if (!auction) {
      socket.emit('error', { message: 'Auction not found.' });
      return;
    }

    if (auction.status !== 'open') {
      socket.emit('error', { message: 'Auction is not open.' });
      return;
    }

    const bid = auction.bids.find(b => b.id === bidId);
    if (!bid) {
      socket.emit('error', { message: 'Bid not found.' });
      return;
    }

    auction.status = 'closed';
    auction.acceptedBidId = bidId;
    console.log(`Auction ${auctionId} closed. Selected bid: ${bidId} by ${bid.producerName}`);

    // Broadcast updated auction to everyone
    io.emit('auction_updated', auction);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
